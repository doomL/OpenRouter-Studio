import type { Edge, Node } from "@xyflow/react";
import type { Workflow } from "@/lib/store";

/** Node `data` keys that often hold huge data URLs / base64 — omit from localStorage backup to avoid quota & churn. */
const HEAVY_NODE_DATA_KEYS = new Set([
  "generatedImage",
  "generatedAudio",
  "generatedTranscript",
  "preview",
  "image_base64",
  "preKeyImage",
  "outputImage",
  "videoDataUrl",
]);

/** Strip only when value is an inline data URL (keep normal https URLs). */
const HEAVY_DATA_URL_ONLY_KEYS = new Set(["imageUrl", "imagePreview"]);

function stripNodeDataForBackup(
  data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!data || typeof data !== "object") return data;
  const out: Record<string, unknown> = { ...data };
  for (const k of HEAVY_NODE_DATA_KEYS) {
    if (k in out) delete out[k];
  }
  for (const k of HEAVY_DATA_URL_ONLY_KEYS) {
    const v = out[k];
    if (typeof v === "string" && v.startsWith("data:") && v.length > 400) {
      delete out[k];
    }
  }
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && v.startsWith("data:") && v.length > 400) {
      delete out[k];
    }
  }
  return out;
}

/** Lighter graph for crash-recovery backup (structure + small fields); heavy blobs remain on server if synced. */
export function stripNodesForLocalBackup(nodes: Node[]): Node[] {
  return nodes.map((n) => ({
    ...n,
    data: stripNodeDataForBackup(n.data as Record<string, unknown>) as Node["data"],
  }));
}

export function stripWorkflowsForLocalBackup(workflows: Workflow[]): Workflow[] {
  return workflows.map((w) => ({
    ...w,
    nodes: stripNodesForLocalBackup(w.nodes),
  }));
}

export type LocalStudioBackup = {
  nodes: Node[];
  edges: Edge[];
  workflows: Workflow[];
  dynamicHandleCounts: Record<string, { image_ref: number; character_ref: number }>;
  savedAt: number;
};

export function buildLightLocalBackup(
  slice: Pick<
    LocalStudioBackup,
    "nodes" | "edges" | "workflows" | "dynamicHandleCounts"
  >
): LocalStudioBackup {
  return {
    nodes: stripNodesForLocalBackup(slice.nodes),
    edges: slice.edges,
    workflows: stripWorkflowsForLocalBackup(slice.workflows),
    dynamicHandleCounts: slice.dynamicHandleCounts,
    savedAt: Date.now(),
  };
}
