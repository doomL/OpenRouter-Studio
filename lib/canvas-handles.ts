import { type Edge, type Node } from "@xyflow/react";
import { pickInlineOrBlobUrl } from "@/lib/studio-node-media-url";

/** Image URL from `node.data` when `nodeOutputs` is empty (e.g. after workflow import / cloud sync). */
export function imageUrlFromPersistedNodeData(node: Node | undefined): string | undefined {
  if (!node) return undefined;
  const d = node.data as Record<string, unknown>;
  switch (node.type) {
    case "imageInput": {
      return (
        pickInlineOrBlobUrl(
          (d.imagePreview as string) || undefined,
          d.imagePreviewBlobId as string | undefined
        ) ||
        pickInlineOrBlobUrl(
          (d.imageUrl as string) || undefined,
          d.imageUrlBlobId as string | undefined
        )
      );
    }
    case "mediaInput": {
      if (d.mediaType !== "image") return undefined;
      return pickInlineOrBlobUrl(
        d.preview as string | undefined,
        d.previewBlobId as string | undefined
      );
    }
    case "imageGen": {
      return pickInlineOrBlobUrl(
        d.generatedImage as string | undefined,
        d.generatedImageBlobId as string | undefined
      );
    }
    default:
      return undefined;
  }
}

/** Playable video URL from `node.data` when `nodeOutputs` is empty (persisted / after sync). */
export function videoUrlFromPersistedNodeData(node: Node | undefined): string | undefined {
  if (!node) return undefined;
  const d = node.data as Record<string, unknown>;
  switch (node.type) {
    case "videoGen":
      return pickInlineOrBlobUrl(
        d.outputVideoDataUrl as string | undefined,
        d.outputVideoDataUrlBlobId as string | undefined
      );
    case "mediaInput": {
      if (d.mediaType !== "video") return undefined;
      const fromStored = pickInlineOrBlobUrl(
        d.videoDataUrl as string | undefined,
        d.videoDataUrlBlobId as string | undefined
      );
      if (fromStored) return fromStored;
      const prev = d.preview as string | undefined;
      if (typeof prev === "string" && prev.length > 0) return prev;
      return undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Restore dynamic handle counts from edges (import/export JSON omits `dynamicHandleCounts`).
 */
export function rebuildDynamicHandleCountsFromEdges(
  edges: Edge[]
): Record<string, { image_ref: number; character_ref: number }> {
  const imageMax = new Map<string, number>();
  const charMax = new Map<string, number>();

  for (const e of edges) {
    const t = e.target;
    if (!t) continue;
    const th = e.targetHandle || "";
    let m = /^image_ref_(\d+)$/.exec(th);
    if (m) {
      const n = parseInt(m[1], 10);
      imageMax.set(t, Math.max(imageMax.get(t) ?? 0, n));
    }
    m = /^character_ref_(\d+)$/.exec(th);
    if (m) {
      const n = parseInt(m[1], 10);
      charMax.set(t, Math.max(charMax.get(t) ?? 0, n));
    }
  }

  const targets = new Set([...imageMax.keys(), ...charMax.keys()]);
  const out: Record<string, { image_ref: number; character_ref: number }> = {};
  for (const tid of targets) {
    const im = imageMax.get(tid) ?? 0;
    const ch = charMax.get(tid) ?? 0;
    out[tid] = {
      image_ref: im > 0 ? im + 1 : 1,
      character_ref: ch > 0 ? ch + 1 : 1,
    };
  }
  return out;
}

export function mergeDynamicHandleCounts(
  a: Record<string, { image_ref: number; character_ref: number }>,
  b: Record<string, { image_ref: number; character_ref: number }>
): Record<string, { image_ref: number; character_ref: number }> {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Record<string, { image_ref: number; character_ref: number }> = {};
  for (const id of ids) {
    const aa = a[id];
    const bb = b[id];
    out[id] = {
      image_ref: Math.max(aa?.image_ref ?? 1, bb?.image_ref ?? 1),
      character_ref: Math.max(aa?.character_ref ?? 1, bb?.character_ref ?? 1),
    };
  }
  return out;
}
