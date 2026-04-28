import type { Edge, Node } from "@xyflow/react";
import { STUDIO_BLOB_MEDIA_FIELDS } from "@/lib/studio-media-blob-fields";

function arrayBufferToDataUrl(buf: ArrayBuffer, mime: string): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

async function fetchBlobAsDataUrl(blobId: string): Promise<string | null> {
  const res = await fetch(`/api/studio/blobs/${encodeURIComponent(blobId)}`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  const mime =
    res.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";
  const buf = await res.arrayBuffer();
  return arrayBufferToDataUrl(buf, mime);
}

/** Resolve *BlobId fields to inline data for a portable JSON download. */
export async function expandStudioGraphForExport(
  nodes: Node[],
  edges: Edge[]
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const outNodes = JSON.parse(JSON.stringify(nodes)) as Node[];

  for (const n of outNodes) {
    const data = {
      ...((typeof n.data === "object" && n.data !== null
        ? n.data
        : {}) as Record<string, unknown>),
    };
    for (const spec of STUDIO_BLOB_MEDIA_FIELDS) {
      const bid = data[spec.blobIdKey];
      if (typeof bid !== "string" || bid.length === 0) continue;
      const existing = data[spec.dataKey];
      if (typeof existing === "string" && existing.startsWith("data:")) continue;
      const url = await fetchBlobAsDataUrl(bid);
      if (url) {
        data[spec.dataKey] = url;
        delete data[spec.blobIdKey];
      }
    }
    n.data = data as Node["data"];
  }

  return { nodes: outNodes, edges };
}
