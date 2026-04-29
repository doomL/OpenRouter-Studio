import {
  parseStudioBlobIdFromRef,
  refUrlsNeedStudioAuth,
  resolveImageUrlForOpenRouter,
} from "@/lib/studio-blob-for-openrouter";

/**
 * Walk chat/completions-style `messages[].content[]` parts with `type: "image_url"`
 * and replace private studio blob URLs with data URLs.
 * Does not scan `image_config`, custom top-level fields, or non-`image_url` part types; those are handled in route-specific code (e.g. image/video routes).
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

function collectVideoImageRefUrls(body: Record<string, unknown>): string[] {
  const urls: string[] = [];
  for (const key of ["input_references", "frame_images"] as const) {
    const arr = body[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (o.type !== "image_url") continue;
      const iu = o.image_url;
      if (!iu || typeof iu !== "object") continue;
      const url = (iu as Record<string, unknown>).url;
      if (typeof url === "string" && url.trim()) urls.push(url);
    }
  }
  return urls;
}

/** Video POST body uses private `/api/studio/blobs/*` URLs — requires signed-in user to inline. */
export function videoBodyReferencesStudioBlobs(body: Record<string, unknown>): boolean {
  return refUrlsNeedStudioAuth(collectVideoImageRefUrls(body));
}

/**
 * Resolve studio blob URLs in `input_references` and `frame_images` to `data:` URLs
 * so OpenRouter (and providers) can fetch image bytes.
 */
export async function normalizeVideoImageRefsInBody(
  body: Record<string, unknown>,
  userId: string | undefined
): Promise<void> {
  for (const key of ["input_references", "frame_images"] as const) {
    const arr = body[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (o.type !== "image_url") continue;
      const iu = o.image_url;
      if (!iu || typeof iu !== "object") continue;
      const urlObj = iu as Record<string, unknown>;
      const url = urlObj.url;
      if (typeof url !== "string" || !url.trim()) continue;
      urlObj.url = await resolveImageUrlForOpenRouter(url, userId);
    }
  }
}
