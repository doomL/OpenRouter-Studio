import { type Edge, type Node } from "@xyflow/react";
import { imageUrlFromPersistedNodeData } from "@/lib/canvas-handles";
import { type NodeOutput } from "./store";

/**
 * Get input values for a node by reading connected source node outputs
 */
export function getNodeInputs(
  nodeId: string,
  edges: Edge[],
  nodeOutputs: Record<string, NodeOutput>
): Record<string, string | undefined> {
  const inputs: Record<string, string | undefined> = {};

  const incomingEdges = edges.filter((e) => e.target === nodeId);
  for (const edge of incomingEdges) {
    const sourceOutput = nodeOutputs[edge.source];
    if (!sourceOutput) continue;

    const sourceHandle = edge.sourceHandle || "";
    const targetHandle = edge.targetHandle || "";

    // Map source output to target input based on handle names
    if (sourceHandle === "prompt" || sourceHandle === "text") {
      inputs[targetHandle || "prompt"] = sourceOutput.text;
    }
    if (sourceHandle === "system") {
      inputs[targetHandle || "system"] = sourceOutput.system || sourceOutput.text;
    }
    if (sourceHandle === "image_url") {
      inputs[targetHandle || "image_url"] = sourceOutput.image_url;
    }
    if (sourceHandle === "image_base64") {
      inputs[targetHandle || "image_base64"] = sourceOutput.image_base64;
    }
    if (sourceHandle === "video_url") {
      inputs[targetHandle || "video_url"] = sourceOutput.video_url;
    }
  }

  return inputs;
}

/**
 * Get all image reference inputs for nodes with dynamic handles.
 * Pass `nodes` so URLs still resolve after import when `nodeOutputs` was cleared but `node.data` has images.
 */
export function getImageRefInputs(
  nodeId: string,
  edges: Edge[],
  nodeOutputs: Record<string, NodeOutput>,
  nodes?: Node[]
): Array<{ handle: string; url: string }> {
  const refs: Array<{ handle: string; url: string }> = [];
  const incomingEdges = edges.filter((e) => e.target === nodeId);
  const nodeById = nodes ? new Map(nodes.map((n) => [n.id, n])) : null;

  for (const edge of incomingEdges) {
    const targetHandle = edge.targetHandle || "";
    if (
      targetHandle.startsWith("image_ref_") ||
      targetHandle.startsWith("character_ref_") ||
      targetHandle === "first_frame" ||
      targetHandle === "last_frame" ||
      targetHandle === "style_ref" ||
      targetHandle === "image_url"
    ) {
      const sourceOutput = nodeOutputs[edge.source];
      let url =
        sourceOutput?.image_url ??
        (sourceOutput?.image_base64
          ? `data:image/png;base64,${sourceOutput.image_base64}`
          : undefined);
      if (!url && nodeById) {
        url = imageUrlFromPersistedNodeData(nodeById.get(edge.source));
      }
      if (url) {
        refs.push({ handle: targetHandle, url });
      }
    }
  }

  return refs;
}
