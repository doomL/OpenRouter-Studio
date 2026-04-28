import {
  parseStudioBlobIdFromRef,
  resolveImageUrlForOpenRouter,
} from "@/lib/studio-blob-for-openrouter";

/**
 * Walk chat/completions-style `messages` and replace private studio blob image URLs
 * with data URLs so upstream providers can consume them.
 */
export async function normalizeVisionImageUrlsInBody(
  body: Record<string, unknown>,
  userId: string | undefined
): Promise<void> {
  const messages = body.messages;
  if (!Array.isArray(messages)) return;

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const content = (msg as Record<string, unknown>).content;
    if (typeof content === "string" || !Array.isArray(content)) continue;

    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type !== "image_url") continue;
      const iu = p.image_url;
      if (!iu || typeof iu !== "object") continue;
      const urlObj = iu as Record<string, unknown>;
      const url = urlObj.url;
      if (typeof url !== "string" || !url.trim()) continue;
      if (parseStudioBlobIdFromRef(url) == null) continue;
      urlObj.url = await resolveImageUrlForOpenRouter(url, userId);
    }
  }
}

export function bodyMessagesReferenceStudioBlobs(body: Record<string, unknown>): boolean {
  const messages = body.messages;
  if (!Array.isArray(messages)) return false;
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const content = (msg as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type !== "image_url") continue;
      const iu = p.image_url;
      if (!iu || typeof iu !== "object") continue;
      const url = (iu as Record<string, unknown>).url;
      if (typeof url === "string" && parseStudioBlobIdFromRef(url) != null) return true;
    }
  }
  return false;
}
