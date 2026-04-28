import { prisma } from "@/lib/prisma";
import { isStudioObjectStorageConfigured, studioGetObjectStream } from "@/lib/studio-s3";

/** Extract studio blob id from a path or absolute URL the client may send. */
export function parseStudioBlobIdFromRef(url: string): string | null {
  const s = url.trim();
  try {
    const pathOnly = s.includes("://") ? new URL(s).pathname : s.split("?")[0] ?? s;
    const m = /^\/api\/studio\/blobs\/([^/?#]+)/.exec(pathOnly);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    const m = /^\/api\/studio\/blobs\/([^/?#]+)/.exec(s);
    return m ? decodeURIComponent(m[1]) : null;
  }
}

export async function studioBlobIdToDataUrlForUser(
  blobId: string,
  userId: string
): Promise<string | null> {
  if (!isStudioObjectStorageConfigured()) return null;
  const blob = await prisma.studioBlob.findFirst({
    where: { id: blobId, userId },
  });
  if (!blob) return null;
  try {
    const obj = await studioGetObjectStream(blob.s3Key);
    const body = obj.Body;
    if (!body) return null;
    const bytes = await body.transformToByteArray();
    const b64 = Buffer.from(bytes).toString("base64");
    return `data:${blob.mimeType};base64,${b64}`;
  } catch {
    return null;
  }
}

/**
 * OpenRouter / upstream providers cannot fetch same-origin `/api/studio/blobs/*` URLs.
 * Resolve those to data URLs (authenticated server-side read). Public http(s) and data: URLs pass through.
 */
export async function resolveImageUrlForOpenRouter(
  url: string,
  userId: string | undefined
): Promise<string> {
  const u = url.trim();
  if (!u) throw new Error("Empty image URL");
  if (u.startsWith("data:")) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) {
    const blobId = parseStudioBlobIdFromRef(u);
    if (blobId) {
      if (!userId) {
        throw new Error(
          "Sign in to use Studio-saved images as model references (blob URLs are private)."
        );
      }
      const dataUrl = await studioBlobIdToDataUrlForUser(blobId, userId);
      if (!dataUrl) {
        throw new Error("Could not load reference image from storage.");
      }
      return dataUrl;
    }
    return u;
  }

  const blobId = parseStudioBlobIdFromRef(u);
  if (blobId) {
    if (!userId) {
      throw new Error(
        "Sign in to use Studio-saved images as model references (blob URLs are private)."
      );
    }
    const dataUrl = await studioBlobIdToDataUrlForUser(blobId, userId);
    if (!dataUrl) {
      throw new Error("Could not load reference image from storage.");
    }
    return dataUrl;
  }

  throw new Error(
    `Invalid image URL for the model provider (expected http(s), data:, or /api/studio/blobs/...): ${u.slice(0, 96)}`
  );
}

export function refUrlsNeedStudioAuth(refUrls: string[]): boolean {
  return refUrls.some((u) => parseStudioBlobIdFromRef(u) != null);
}
