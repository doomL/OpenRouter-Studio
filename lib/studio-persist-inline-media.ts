import type { Node } from "@xyflow/react";
import { prisma } from "@/lib/prisma";
import type { Workflow } from "@/lib/store";
import {
  STUDIO_BLOB_MEDIA_FIELDS,
  parseDataUrlToBuffer,
  rawBase64ToBuffer,
  shouldUploadStudioMediaValue,
} from "@/lib/studio-media-blob-fields";
import {
  isStudioObjectStorageConfigured,
  studioDeleteObject,
  studioPutObject,
} from "@/lib/studio-s3";

const MAX_VERSIONS_PER_NODE_KIND = 20;

function deepCloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

async function blobReferencedInJsonBlob(userId: string, blobId: string): Promise<boolean> {
  const row = await prisma.userStudioState.findUnique({
    where: { userId },
    select: { nodes: true, workflows: true },
  });
  if (!row) return false;
  const needle = JSON.stringify(blobId);
  const hay = JSON.stringify(row.nodes) + JSON.stringify(row.workflows);
  return hay.includes(needle);
}

async function pruneOldVersions(userId: string, nodeId: string, kind: string) {
  const extras = await prisma.studioNodeMediaVersion.findMany({
    where: { userId, nodeId, kind },
    orderBy: { createdAt: "desc" },
    skip: MAX_VERSIONS_PER_NODE_KIND,
    select: { id: true, blobId: true },
  });
  for (const ex of extras) {
    await prisma.studioNodeMediaVersion.delete({ where: { id: ex.id } });
    await maybeDeleteOrphanBlob(userId, ex.blobId);
  }
}

async function maybeDeleteOrphanBlob(userId: string, blobId: string) {
  const vc = await prisma.studioNodeMediaVersion.count({ where: { blobId } });
  if (vc > 0) return;
  if (await blobReferencedInJsonBlob(userId, blobId)) return;
  const blob = await prisma.studioBlob.findFirst({
    where: { id: blobId, userId },
    select: { id: true, s3Key: true },
  });
  if (!blob) return;
  try {
    await studioDeleteObject(blob.s3Key);
  } catch {
    // object may already be gone
  }
  await prisma.studioBlob.delete({ where: { id: blob.id } }).catch(() => {});
}

async function recordReplacedBlob(
  userId: string,
  nodeId: string,
  kind: string,
  previousBlobId: string | undefined
) {
  if (!previousBlobId) return;
  // Canvas + embedded workflow snapshots can both run `inlineNodeDataMediaToBlobs` for the same
  // node id in one PUT; avoid duplicate history rows for the same (node, kind, blob).
  const already = await prisma.studioNodeMediaVersion.findFirst({
    where: { userId, nodeId, kind, blobId: previousBlobId },
    select: { id: true },
  });
  if (already) return;
  await prisma.studioNodeMediaVersion.create({
    data: { userId, nodeId, blobId: previousBlobId, kind },
  });
  await pruneOldVersions(userId, nodeId, kind);
}

async function uploadBufferForUser(
  userId: string,
  buffer: Buffer,
  mimeType: string,
  provenance?: {
    sourceNodeId: string;
    sourceNodeType: string;
    sourceNodeLabel: string;
    mediaFieldKind: string;
  }
): Promise<string> {
  const created = await prisma.studioBlob.create({
    data: {
      userId,
      s3Key: `${userId}/pending`,
      mimeType,
      byteSize: buffer.length,
      sourceNodeId: provenance?.sourceNodeId,
      sourceNodeType: provenance?.sourceNodeType,
      sourceNodeLabel: provenance?.sourceNodeLabel,
      mediaFieldKind: provenance?.mediaFieldKind,
    },
  });
  const s3Key = `${userId}/${created.id}`;
  await prisma.studioBlob.update({
    where: { id: created.id },
    data: { s3Key },
  });
  await studioPutObject(s3Key, buffer, mimeType);
  return created.id;
}

async function inlineNodeDataMediaToBlobs(
  userId: string,
  node: Pick<Node, "id" | "type">,
  data: Record<string, unknown>,
  dedup: Map<string, string>
) {
  const nodeId = node.id;
  for (const spec of STUDIO_BLOB_MEDIA_FIELDS) {
    const raw = data[spec.dataKey];
    if (!shouldUploadStudioMediaValue(spec, raw)) continue;

    const existingDedup = dedup.get(raw);
    let newBlobId: string;

    if (existingDedup) {
      newBlobId = existingDedup;
    } else {
      let buffer: Buffer | null = null;
      let mime = "application/octet-stream";
      if (raw.startsWith("data:")) {
        const parsed = parseDataUrlToBuffer(raw);
        if (parsed) {
          buffer = parsed.buffer;
          mime = parsed.mimeType;
        }
      } else {
        buffer = rawBase64ToBuffer(raw);
        mime = "image/png";
      }
      if (!buffer || buffer.length === 0) continue;
      const nodeType = node.type ?? "unknown";
      const nodeLabel =
        typeof data.label === "string" && data.label.trim()
          ? data.label.trim()
          : nodeType;
      newBlobId = await uploadBufferForUser(userId, buffer, mime, {
        sourceNodeId: nodeId,
        sourceNodeType: nodeType,
        sourceNodeLabel: nodeLabel,
        mediaFieldKind: spec.kind,
      });
      dedup.set(raw, newBlobId);
    }

    const prevBlobId =
      typeof data[spec.blobIdKey] === "string"
        ? (data[spec.blobIdKey] as string)
        : undefined;
    if (prevBlobId && prevBlobId !== newBlobId) {
      await recordReplacedBlob(userId, nodeId, spec.kind, prevBlobId);
    }
    data[spec.blobIdKey] = newBlobId;
    delete data[spec.dataKey];
  }
}

/** Upload inline / huge base64 in node.data to object storage and swap for *BlobId fields. No-op if S3 env is not configured. */
export async function persistStudioGraphMediaToBlobs(
  userId: string,
  nodes: Node[],
  workflows: Workflow[]
): Promise<{ nodes: Node[]; workflows: Workflow[] }> {
  if (!isStudioObjectStorageConfigured()) {
    return { nodes, workflows };
  }

  const outNodes = deepCloneJson(nodes);
  const outWorkflows = deepCloneJson(workflows);

  for (const n of outNodes) {
    const data = {
      ...((typeof n.data === "object" && n.data !== null
        ? n.data
        : {}) as Record<string, unknown>),
    };
    const dedup = new Map<string, string>();
    await inlineNodeDataMediaToBlobs(userId, n, data, dedup);
    n.data = data as Node["data"];
  }

  for (const w of outWorkflows) {
    for (const n of w.nodes) {
      const data = {
        ...((typeof n.data === "object" && n.data !== null
          ? n.data
          : {}) as Record<string, unknown>),
      };
      const dedup = new Map<string, string>();
      await inlineNodeDataMediaToBlobs(userId, n, data, dedup);
      n.data = data as Node["data"];
    }
  }

  return { nodes: outNodes, workflows: outWorkflows };
}
