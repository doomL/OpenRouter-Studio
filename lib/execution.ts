import { type Edge, type Node } from "@xyflow/react";
import { imageUrlFromPersistedNodeData } from "@/lib/canvas-handles";
import { pickInlineOrBlobUrl } from "@/lib/studio-node-media-url";
import { type NodeOutput } from "./store";

function hasUsefulText(v: string | undefined): boolean {
  return v != null && String(v).length > 0;
}

/**
 * Prefer live `nodeOutputs`, but fill from `node.data` when outputs are missing or still empty
 * (hydration race, sync clearing outputs, or stale empty objects).
 */
function mergeSourceOutputWithNodeData(
  sourceId: string,
  base: NodeOutput | undefined,
  nodeById: Map<string, Node> | null
): NodeOutput | undefined {
  if (!nodeById) return base;
  const srcNode = nodeById.get(sourceId);
  if (!srcNode) return base;

  if (srcNode.type === "prompt") {
    const d = srcNode.data as Record<string, unknown>;
    const pText = typeof d.prompt === "string" ? d.prompt : "";
    const sText = typeof d.systemPrompt === "string" ? d.systemPrompt : "";
    return {
      ...(base ?? {}),
      text: hasUsefulText(base?.text) ? base!.text : pText,
      system: hasUsefulText(base?.system) ? base!.system : sText,
      status: base?.status ?? "done",
    };
  }

  if (srcNode.type === "llm") {
    const d = srcNode.data as Record<string, unknown>;
    const g = d.generatedText;
    const persisted = typeof g === "string" && g.length > 0 ? g : undefined;
    if (!hasUsefulText(base?.text) && !persisted && !base) return undefined;
    return {
      ...(base ?? {}),
      text: hasUsefulText(base?.text) ? base!.text : persisted ?? base?.text ?? "",
      status: base?.status ?? "done",
    };
  }

  if (srcNode.type === "audioGen") {
    const d = srcNode.data as Record<string, unknown>;
    const t = d.generatedTranscript;
    const persisted = typeof t === "string" && t.length > 0 ? t : undefined;
    if (!hasUsefulText(base?.text) && !persisted && !base) return undefined;
    return {
      ...(base ?? {}),
      text: hasUsefulText(base?.text) ? base!.text : persisted ?? base?.text ?? "",
      status: base?.status ?? "done",
    };
  }

  if (srcNode.type === "transcribe") {
    const d = srcNode.data as Record<string, unknown>;
    const t = d.transcript;
    const persisted = typeof t === "string" && t.length > 0 ? t : undefined;
    if (!hasUsefulText(base?.text) && !persisted && !base) return undefined;
    return {
      ...(base ?? {}),
      text: hasUsefulText(base?.text) ? base!.text : persisted ?? base?.text ?? "",
      status: base?.status ?? "done",
    };
  }

  if (srcNode.type === "videoGen") {
    const d = srcNode.data as Record<string, unknown>;
    const persisted = pickInlineOrBlobUrl(
      d.outputVideoDataUrl as string | undefined,
      d.outputVideoDataUrlBlobId as string | undefined
    );
    const videoUrl = base?.video_url ?? persisted;
    if (!videoUrl) return base;
    return {
      ...(base ?? {}),
      video_url: videoUrl,
      status: base?.status === "error" ? "error" : (base?.status ?? "done"),
    };
  }

  if (srcNode.type === "mediaInput") {
    const d = srcNode.data as Record<string, unknown>;
    if (d.mediaType !== "audio") return base;
    const fromBlob = pickInlineOrBlobUrl(
      d.audioDataUrl as string | undefined,
      d.audioDataUrlBlobId as string | undefined
    );
    const urlInput = typeof d.urlInput === "string" ? d.urlInput.trim() : "";
    const audioUrl =
      base?.audio_url ?? fromBlob ?? (urlInput.match(/^https?:\/\//) ? urlInput : undefined);
    if (!audioUrl) return base;
    return {
      ...(base ?? {}),
      audio_url: audioUrl,
      status: base?.status === "error" ? "error" : (base?.status ?? "done"),
    };
  }

  return base;
}

/**
 * Get input values for a node by reading connected source node outputs
 */
export function getNodeInputs(
  nodeId: string,
  edges: Edge[],
  nodeOutputs: Record<string, NodeOutput>,
  nodes?: Node[]
): Record<string, string | undefined> {
  const inputs: Record<string, string | undefined> = {};
  const nodeById = nodes ? new Map(nodes.map((n) => [n.id, n])) : null;

  const incomingEdges = edges.filter((e) => e.target === nodeId);
  for (const edge of incomingEdges) {
    const sourceOutput = mergeSourceOutputWithNodeData(
      edge.source,
      nodeOutputs[edge.source],
      nodeById
    );
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
    if (sourceHandle === "audio_url") {
      inputs[targetHandle || "audio_url"] = sourceOutput.audio_url;
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

/**
 * Compact fingerprint for zustand selectors: changes when any upstream image used as a ref
 * into `nodeId` might have changed (outputs or persisted node.data media fields).
 */
export function imageRefSourcesSignature(
  nodeId: string,
  edges: Edge[],
  nodeOutputs: Record<string, NodeOutput>,
  nodes: Node[]
): string {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const parts: string[] = [];
  for (const e of edges) {
    if (e.target !== nodeId) continue;
    const th = e.targetHandle || "";
    if (
      !th.startsWith("image_ref_") &&
      !th.startsWith("character_ref_") &&
      th !== "first_frame" &&
      th !== "last_frame" &&
      th !== "style_ref" &&
      th !== "image_url"
    ) {
      continue;
    }
    const src = e.source;
    const o = nodeOutputs[src];
    const n = nodeById.get(src);
    const d = (n?.data ?? {}) as Record<string, unknown>;
    const blob =
      (d.generatedImageBlobId as string) ||
      (d.imagePreviewBlobId as string) ||
      (d.imageUrlBlobId as string) ||
      (d.previewBlobId as string) ||
      "";
    const inlineLen = (() => {
      const a = d.generatedImage as string | undefined;
      const b = d.imagePreview as string | undefined;
      const c = d.imageUrl as string | undefined;
      const p = d.preview as string | undefined;
      return Math.max(
        a?.length ?? 0,
        b?.length ?? 0,
        c?.length ?? 0,
        p?.length ?? 0
      );
    })();
    parts.push(
      `${src}:${th}:${o?.image_url ?? ""}:${o?.image_base64?.length ?? 0}:${blob}:${inlineLen}`
    );
  }
  parts.sort();
  return parts.join("|");
}
