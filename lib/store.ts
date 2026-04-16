import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import {
  mergeDynamicHandleCounts,
  rebuildDynamicHandleCountsFromEdges,
} from "@/lib/canvas-handles";

export interface NodeOutput {
  text?: string;
  system?: string;
  image_url?: string;
  image_base64?: string;
  video_url?: string;
  audio_url?: string;
  status: "idle" | "loading" | "done" | "error";
  error?: string;
}

export interface VideoJob {
  jobId: string;
  nodeId: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled" | "expired";
  startedAt: number;
  videoUrl?: string;
  error?: string;
}

export interface Workflow {
  id: string;
  name: string;
  savedAt: string;
  nodes: Node[];
  edges: Edge[];
}

/** Undo/redo snapshot */
interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

export const STUDIO_NODE_CLIPBOARD_VERSION = 1;

/** Subgraph copied from the canvas (no wrapper fields). */
export type StudioNodesFragment = {
  nodes: Node[];
  edges: Edge[];
  dynamicHandleCounts?: Record<
    string,
    { image_ref: number; character_ref: number }
  >;
};

export function parseStudioNodeClipboard(text: string): StudioNodesFragment | null {
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    if (
      o.studioClipboard !== true ||
      o.version !== STUDIO_NODE_CLIPBOARD_VERSION ||
      !Array.isArray(o.nodes) ||
      o.nodes.length === 0
    ) {
      return null;
    }
    return {
      nodes: o.nodes as Node[],
      edges: Array.isArray(o.edges) ? (o.edges as Edge[]) : [],
      dynamicHandleCounts:
        o.dynamicHandleCounts &&
        typeof o.dynamicHandleCounts === "object" &&
        o.dynamicHandleCounts !== null
          ? (o.dynamicHandleCounts as StudioNodesFragment["dynamicHandleCounts"])
          : undefined,
    };
  } catch {
    return null;
  }
}

/** Handle type compatibility for connection validation */
const HANDLE_TYPES: Record<string, string> = {
  // source handles → type
  prompt: "text",
  text: "text",
  system: "text",
  image_url: "image",
  image_base64: "image",
  video_url: "video",
  audio_url: "audio",
};

function getHandleType(handleId: string): string {
  if (HANDLE_TYPES[handleId]) return HANDLE_TYPES[handleId];
  if (handleId.startsWith("image_ref_") || handleId === "first_frame" ||
      handleId === "last_frame" || handleId === "style_ref") return "image";
  if (handleId.startsWith("character_ref_")) return "image";
  return "any";
}

/** Check if source→target handle connection is valid */
export function isValidConnection(sourceHandle: string, targetHandle: string): boolean {
  const srcType = getHandleType(sourceHandle);
  const tgtType = getHandleType(targetHandle);
  if (srcType === "any" || tgtType === "any") return true;
  // text→text, image→image, video→video, audio→audio
  // Also allow text→prompt/system
  if (srcType === tgtType) return true;
  // Special: text source can connect to prompt/system targets
  if (srcType === "text" && (targetHandle === "prompt" || targetHandle === "system")) return true;
  // Video out → first/last frame (extend / continue shot on another Video node)
  if (
    srcType === "video" &&
    (targetHandle === "first_frame" || targetHandle === "last_frame")
  ) {
    return true;
  }
  return false;
}

interface StudioState {
  // API Key
  apiKey: string;
  setApiKey: (key: string) => void;

  // Models cache
  models: { text: Model[]; image: Model[]; video: Model[]; audio: Model[] } | null;
  setModels: (models: { text: Model[]; image: Model[]; video: Model[]; audio: Model[] }) => void;

  // Canvas
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  duplicateNode: (nodeId: string) => void;
  /** Selected nodes + edges between them + handle counts (for copy/paste). */
  buildSelectedNodesClipboardPayload: () => StudioNodesFragment | null;
  /** Clone fragment with new ids, offset positions, merge edges & handle counts. */
  pasteNodesFragment: (fragment: StudioNodesFragment) => void;

  // Node outputs
  nodeOutputs: Record<string, NodeOutput>;
  setNodeOutput: (nodeId: string, output: NodeOutput) => void;

  // Dynamic handle counts
  dynamicHandleCounts: Record<string, { image_ref: number; character_ref: number }>;
  updateDynamicHandleCount: (nodeId: string, type: "image_ref" | "character_ref", count: number) => void;

  // Video jobs
  videoJobs: Record<string, VideoJob>;
  setVideoJob: (nodeId: string, job: VideoJob) => void;

  // Workflows
  workflows: Workflow[];
  saveWorkflow: (name: string) => void;
  loadWorkflow: (id: string) => void;
  deleteWorkflow: (id: string) => void;
  newWorkflow: () => void;
  exportWorkflow: () => string;
  importWorkflow: (json: string) => boolean;

  // Theme
  theme: "dark" | "light";
  toggleTheme: () => void;

  /** When true, new positions snap to the canvas background grid while dragging. */
  snapToGrid: boolean;
  toggleSnapToGrid: () => void;
  /** Round every node position to the grid (one-shot layout). */
  snapAllNodesToGrid: () => void;

  // Undo / Redo
  history: HistoryEntry[];
  historyIndex: number;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Cost tracker
  sessionCost: number;
  addCost: (amount: number) => void;
  resetCost: () => void;

  /** Server snapshot (GET /api/settings/studio) */
  hydrateFromServer: (payload: StudioServerSnapshot) => void;
  clearStudioForLogout: () => void;
}

/** Payload from cloud sync; shapes match API JSON. */
export interface StudioServerSnapshot {
  apiKey?: string;
  theme?: string;
  nodes?: Node[];
  edges?: Edge[];
  workflows?: Workflow[];
  videoJobs?: Record<string, VideoJob>;
  dynamicHandleCounts?: Record<
    string,
    { image_ref: number; character_ref: number }
  >;
}

export interface Model {
  id: string;
  name: string;
  description?: string;
  pricing?: { prompt: string; completion: string };
  priceLabel?: string;
  context_length?: number;
  architecture?: { modality: string };
  output_modalities?: string[];
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      // API Key
      apiKey: "",
      setApiKey: (key) => set({ apiKey: key }),

      // Models
      models: null,
      setModels: (models) => set({ models }),

      // Canvas
      nodes: [],
      edges: [],
      onNodesChange: (changes) => {
        // Push history before deletes
        const hasDeletes = changes.some((c) => c.type === "remove");
        if (hasDeletes) get().pushHistory();
        set({ nodes: applyNodeChanges(changes, get().nodes) });
      },
      onEdgesChange: (changes) => {
        const hasDeletes = changes.some((c) => c.type === "remove");
        if (hasDeletes) get().pushHistory();
        set({ edges: applyEdgeChanges(changes, get().edges) });
      },
      onConnect: (connection) => {
        // Validate connection type compatibility
        if (connection.sourceHandle && connection.targetHandle) {
          if (!isValidConnection(connection.sourceHandle, connection.targetHandle)) {
            return; // Block invalid connections
          }
        }
        get().pushHistory();
        set({ edges: addEdge(connection, get().edges) });
        // Update dynamic handle counts
        const targetNode = get().nodes.find((n) => n.id === connection.target);
        if (targetNode && connection.targetHandle) {
          const handle = connection.targetHandle;
          const match = handle.match(/^(image_ref|character_ref)_(\d+)$/);
          if (match) {
            const type = match[1] as "image_ref" | "character_ref";
            const current = get().dynamicHandleCounts[connection.target]?.[type] || 1;
            const idx = parseInt(match[2]);
            if (idx >= current) {
              get().updateDynamicHandleCount(connection.target, type, idx + 1);
            }
          }
        }
      },
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      addNode: (node) => {
        get().pushHistory();
        set({ nodes: [...get().nodes, node] });
      },
      updateNodeData: (nodeId, data) =>
        set({
          nodes: get().nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
          ),
        }),
      duplicateNode: (nodeId) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        if (!node) return;
        get().pushHistory();
        const newId = `${node.type}-${Date.now()}`;
        const clone: Node = {
          ...node,
          id: newId,
          position: { x: node.position.x + 40, y: node.position.y + 40 },
          selected: false,
          data: { ...node.data },
        };
        set({ nodes: [...get().nodes, clone] });
      },
      buildSelectedNodesClipboardPayload: () => {
        const { nodes, edges, dynamicHandleCounts } = get();
        const selected = nodes.filter((n) => n.selected);
        if (selected.length === 0) return null;
        const ids = new Set(selected.map((n) => n.id));
        const fragmentNodes = JSON.parse(JSON.stringify(selected)) as Node[];
        const fragmentEdges = JSON.parse(
          JSON.stringify(
            edges.filter((e) => ids.has(e.source) && ids.has(e.target))
          )
        ) as Edge[];
        const fragmentCounts: NonNullable<StudioNodesFragment["dynamicHandleCounts"]> =
          {};
        for (const id of ids) {
          const c = dynamicHandleCounts[id];
          if (c) fragmentCounts[id] = { ...c };
        }
        return {
          nodes: fragmentNodes,
          edges: fragmentEdges,
          dynamicHandleCounts:
            Object.keys(fragmentCounts).length > 0 ? fragmentCounts : undefined,
        };
      },
      pasteNodesFragment: (fragment) => {
        const { nodes: sourceNodes, edges: sourceEdges, dynamicHandleCounts: srcCounts } =
          fragment;
        if (!sourceNodes.length) return;
        get().pushHistory();
        const idMap = new Map<string, string>();
        sourceNodes.forEach((n, i) => {
          idMap.set(
            n.id,
            `${n.type}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`
          );
        });
        const OFFSET = 40;
        const newNodes: Node[] = sourceNodes.map((n) => {
          const clone = JSON.parse(JSON.stringify(n)) as Node;
          clone.id = idMap.get(n.id)!;
          clone.position = {
            x: n.position.x + OFFSET,
            y: n.position.y + OFFSET,
          };
          clone.selected = true;
          return clone;
        });
        const newEdges: Edge[] = sourceEdges
          .map((e, i) => {
            const src = idMap.get(e.source);
            const tgt = idMap.get(e.target);
            if (!src || !tgt) return null;
            const c = JSON.parse(JSON.stringify(e)) as Edge;
            c.id = `e-${src}-${tgt}-${Date.now()}-${i}`;
            c.source = src;
            c.target = tgt;
            return c;
          })
          .filter((e): e is Edge => e !== null);
        const existingNodes = get().nodes.map((n) => ({ ...n, selected: false }));
        const newDynamic = { ...get().dynamicHandleCounts };
        if (srcCounts) {
          for (const oldId of Object.keys(srcCounts)) {
            const nid = idMap.get(oldId);
            if (nid) newDynamic[nid] = { ...srcCounts[oldId] };
          }
        }
        set({
          nodes: [...existingNodes, ...newNodes],
          edges: [...get().edges, ...newEdges],
          dynamicHandleCounts: newDynamic,
        });
      },

      // Node outputs
      nodeOutputs: {},
      setNodeOutput: (nodeId, output) =>
        set({ nodeOutputs: { ...get().nodeOutputs, [nodeId]: output } }),

      // Dynamic handles
      dynamicHandleCounts: {},
      updateDynamicHandleCount: (nodeId, type, count) =>
        set({
          dynamicHandleCounts: {
            ...get().dynamicHandleCounts,
            [nodeId]: {
              ...get().dynamicHandleCounts[nodeId],
              [type]: count,
            },
          },
        }),

      // Video jobs
      videoJobs: {},
      setVideoJob: (nodeId, job) =>
        set({ videoJobs: { ...get().videoJobs, [nodeId]: job } }),

      // Workflows
      workflows: [],
      saveWorkflow: (name) => {
        const { nodes, edges, workflows } = get();
        const workflow: Workflow = {
          id: crypto.randomUUID(),
          name,
          savedAt: new Date().toISOString(),
          nodes,
          edges,
        };
        const updated = [workflow, ...workflows].slice(0, 10);
        set({ workflows: updated });
      },
      loadWorkflow: (id) => {
        const workflow = get().workflows.find((w) => w.id === id);
        if (workflow) {
          set({
            nodes: workflow.nodes,
            edges: workflow.edges,
            nodeOutputs: {},
            dynamicHandleCounts: rebuildDynamicHandleCountsFromEdges(workflow.edges),
          });
        }
      },
      deleteWorkflow: (id) =>
        set({ workflows: get().workflows.filter((w) => w.id !== id) }),
      newWorkflow: () =>
        set({
          nodes: [],
          edges: [],
          nodeOutputs: {},
          dynamicHandleCounts: {},
          videoJobs: {},
        }),
      exportWorkflow: () => {
        const { nodes, edges } = get();
        return JSON.stringify({ nodes, edges, version: 1 }, null, 2);
      },
      importWorkflow: (json: string) => {
        try {
          const data = JSON.parse(json);
          if (!data.nodes || !data.edges) return false;
          get().pushHistory();
          set({
            nodes: data.nodes,
            edges: data.edges,
            nodeOutputs: {},
            dynamicHandleCounts: rebuildDynamicHandleCountsFromEdges(data.edges),
          });
          return true;
        } catch {
          return false;
        }
      },

      // Theme
      theme: "dark",
      toggleTheme: () =>
        set({ theme: get().theme === "dark" ? "light" : "dark" }),

      snapToGrid: false,
      toggleSnapToGrid: () => set({ snapToGrid: !get().snapToGrid }),
      snapAllNodesToGrid: () => {
        const GRID = 16;
        const { nodes } = get();
        if (nodes.length === 0) return;
        get().pushHistory();
        set({
          nodes: nodes.map((n) => ({
            ...n,
            position: {
              x: Math.round(n.position.x / GRID) * GRID,
              y: Math.round(n.position.y / GRID) * GRID,
            },
          })),
        });
      },

      // Undo / Redo
      history: [],
      historyIndex: -1,
      pushHistory: () => {
        const { nodes, edges, history, historyIndex } = get();
        // Trim future entries if we undid something
        const trimmed = history.slice(0, historyIndex + 1);
        const entry: HistoryEntry = {
          nodes: JSON.parse(JSON.stringify(nodes)),
          edges: JSON.parse(JSON.stringify(edges)),
        };
        const updated = [...trimmed, entry].slice(-MAX_HISTORY);
        set({ history: updated, historyIndex: updated.length - 1 });
      },
      undo: () => {
        const { history, historyIndex, nodes, edges } = get();
        if (historyIndex < 0) return;
        // Save current state as "future" if we haven't already
        const entry = history[historyIndex];
        if (!entry) return;
        // If at the tip, push current first so redo works
        if (historyIndex === history.length - 1) {
          const current: HistoryEntry = {
            nodes: JSON.parse(JSON.stringify(nodes)),
            edges: JSON.parse(JSON.stringify(edges)),
          };
          set({
            nodes: entry.nodes,
            edges: entry.edges,
            history: [...history, current],
            historyIndex: historyIndex - 1,
          });
        } else {
          set({
            nodes: entry.nodes,
            edges: entry.edges,
            historyIndex: historyIndex - 1,
          });
        }
      },
      redo: () => {
        const { history, historyIndex } = get();
        const nextIndex = historyIndex + 2; // +2 because undo decrements by 1 and we want the one after current
        if (nextIndex >= history.length) return;
        const entry = history[nextIndex];
        if (!entry) return;
        set({
          nodes: entry.nodes,
          edges: entry.edges,
          historyIndex: historyIndex + 1,
        });
      },

      // Cost tracker
      sessionCost: 0,
      addCost: (amount) => set({ sessionCost: get().sessionCost + amount }),
      resetCost: () => set({ sessionCost: 0 }),

      hydrateFromServer: (payload) => {
        const theme =
          payload.theme === "light" || payload.theme === "dark"
            ? payload.theme
            : "dark";
        const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
        const edges = Array.isArray(payload.edges) ? payload.edges : [];
        const fromEdges = rebuildDynamicHandleCountsFromEdges(edges);
        const fromPayload =
          payload.dynamicHandleCounts &&
          typeof payload.dynamicHandleCounts === "object"
            ? payload.dynamicHandleCounts
            : {};
        set({
          apiKey: typeof payload.apiKey === "string" ? payload.apiKey : "",
          theme,
          nodes,
          edges,
          workflows: Array.isArray(payload.workflows) ? payload.workflows : [],
          videoJobs:
            payload.videoJobs && typeof payload.videoJobs === "object"
              ? payload.videoJobs
              : {},
          dynamicHandleCounts: mergeDynamicHandleCounts(fromEdges, fromPayload),
          nodeOutputs: {},
          history: [],
          historyIndex: -1,
          models: null,
        });
      },
      clearStudioForLogout: () =>
        set({
          apiKey: "",
          nodes: [],
          edges: [],
          workflows: [],
          videoJobs: {},
          dynamicHandleCounts: {},
          nodeOutputs: {},
          models: null,
          history: [],
          historyIndex: -1,
          sessionCost: 0,
          theme: "dark",
        }),
    }),
    {
      // v2: only theme is local; canvas/API key sync from server per account
      name: "openrouter-studio-v2",
      partialize: (state) => ({
        theme: state.theme,
        snapToGrid: state.snapToGrid,
      }),
    }
  )
);
