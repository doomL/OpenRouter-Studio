"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type ReactFlowInstance,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  useStudioStore,
  isValidConnection,
  parseStudioNodeClipboard,
  STUDIO_NODE_CLIPBOARD_VERSION,
} from "@/lib/store";
import { nodeTypes } from "./nodes";

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return target.closest("[contenteditable='true']") != null;
}

export function StudioCanvas() {
  const nodes = useStudioStore((s) => s.nodes);
  const edges = useStudioStore((s) => s.edges);
  const onNodesChange = useStudioStore((s) => s.onNodesChange);
  const onEdgesChange = useStudioStore((s) => s.onEdgesChange);
  const onConnect = useStudioStore((s) => s.onConnect);
  const addNode = useStudioStore((s) => s.addNode);
  const duplicateNode = useStudioStore((s) => s.duplicateNode);
  const buildSelectedNodesClipboardPayload = useStudioStore(
    (s) => s.buildSelectedNodesClipboardPayload
  );
  const pasteNodesFragment = useStudioStore((s) => s.pasteNodesFragment);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const theme = useStudioStore((s) => s.theme);
  const nodeOutputs = useStudioStore((s) => s.nodeOutputs);

  const rfInstance = useRef<ReactFlowInstance | null>(null);

  // Keyboard shortcuts: undo/redo, duplicate, copy/paste nodes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;

      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "d") {
        e.preventDefault();
        const selected = nodes.find((n) => n.selected);
        if (selected) duplicateNode(selected.id);
      } else if (e.key === "c" || e.key === "C") {
        if (isEditableEventTarget(e.target)) return;
        const fragment = buildSelectedNodesClipboardPayload();
        if (!fragment) return;
        e.preventDefault();
        void navigator.clipboard.writeText(
          JSON.stringify({
            studioClipboard: true,
            version: STUDIO_NODE_CLIPBOARD_VERSION,
            ...fragment,
          })
        );
      } else if (e.key === "v" || e.key === "V") {
        if (isEditableEventTarget(e.target)) return;
        e.preventDefault();
        void (async () => {
          try {
            const text = await navigator.clipboard.readText();
            const fragment = parseStudioNodeClipboard(text);
            if (fragment) pasteNodesFragment(fragment);
          } catch {
            /* clipboard unavailable or denied */
          }
        })();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    undo,
    redo,
    duplicateNode,
    nodes,
    buildSelectedNodesClipboardPayload,
    pasteNodesFragment,
  ]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow");
      if (!type || !rfInstance.current) return;

      const position = rfInstance.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const id = `${type}-${Date.now()}`;
      addNode({ id, type, position, data: {} });
    },
    [addNode]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  // Connection validation
  const validateConnection = useCallback((connection: Edge | Connection) => {
    if (!connection.sourceHandle || !connection.targetHandle) return true;
    return isValidConnection(connection.sourceHandle, connection.targetHandle);
  }, []);

  const isDark = theme === "dark";

  // Compute animated edges based on nodeOutputs status
  const styledEdges: Edge[] = edges.map((edge) => {
    const srcOutput = nodeOutputs[edge.source];
    const isActive = srcOutput?.status === "loading";
    const isDone = srcOutput?.status === "done";
    return {
      ...edge,
      animated: isActive || undefined,
      style: {
        stroke: isActive
          ? "#eab308"
          : isDone
          ? (isDark ? "#666" : "#999")
          : (isDark ? "#555" : "#b0b0b0"),
        strokeWidth: isActive ? 3 : 2,
      },
    };
  });

  return (
    <div className="flex-1 h-full bg-studio-canvas">
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => {
          rfInstance.current = instance;
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        isValidConnection={validateConnection}
        fitView
        fitViewOptions={{ minZoom: 0.08, padding: 0.2 }}
        minZoom={0.08}
        maxZoom={4}
        deleteKeyCode={["Backspace", "Delete"]}
        colorMode={isDark ? "dark" : "light"}
        edgesReconnectable
        defaultEdgeOptions={{
          style: { stroke: isDark ? "#555" : "#b0b0b0", strokeWidth: 2 },
          type: "smoothstep",
          selectable: true,
          interactionWidth: 20,
        }}
      >
        <Controls />
        <MiniMap
          nodeColor={isDark ? "#333" : "#d4d4d4"}
          maskColor={isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)"}
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color={isDark ? "#333" : "#d4d4d4"}
        />
      </ReactFlow>
    </div>
  );
}
