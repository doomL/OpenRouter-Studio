import { type Edge, type Node } from "@xyflow/react";

/** Image URL from `node.data` when `nodeOutputs` is empty (e.g. after workflow import). */
export function imageUrlFromPersistedNodeData(node: Node | undefined): string | undefined {
  if (!node) return undefined;
  const d = node.data as Record<string, unknown>;
  switch (node.type) {
    case "imageInput": {
      const u = (d.imageUrl as string) || (d.imagePreview as string);
      return u?.length ? u : undefined;
    }
    case "mediaInput": {
      if (d.mediaType !== "image") return undefined;
      const p = d.preview as string;
      return p?.length ? p : undefined;
    }
    case "imageGen": {
      const g = d.generatedImage as string;
      return g?.length ? g : undefined;
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
