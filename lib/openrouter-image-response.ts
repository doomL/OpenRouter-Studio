/**
 * Normalize OpenRouter / provider differences: `image_url` vs `imageUrl`, `message.images` vs
 * image parts embedded in `message.content[]`.
 */
export function extractGeneratedImageUrl(message: unknown): string | undefined {
  if (!message || typeof message !== "object") return undefined;
  const m = message as Record<string, unknown>;

  const urlFromPack = (pack: unknown): string | undefined => {
    if (!pack || typeof pack !== "object") return undefined;
    const url = (pack as Record<string, unknown>).url;
    return typeof url === "string" && url.length > 0 ? url : undefined;
  };

  const fromImagesArray = (images: unknown): string | undefined => {
    if (!Array.isArray(images) || images.length === 0) return undefined;
    for (const item of images) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (typeof o.url === "string" && o.url.length > 0) return o.url;
      const u = urlFromPack(o.image_url ?? o.imageUrl);
      if (u) return u;
    }
    return undefined;
  };

  const fromContent = fromImagesArray(m.images);
  if (fromContent) return fromContent;

  const content = m.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "image_url" || p.type === "image") {
        const u =
          urlFromPack(p.image_url ?? p.imageUrl) ??
          (typeof p.url === "string" && p.url.length > 0 ? p.url : undefined);
        if (u) return u;
      }
    }
  }

  if (typeof content === "string") {
    const s = content.trim();
    // Some providers return a lone data URL or URL string as message.content
    if (s.startsWith("data:image/")) return s;
    if (/^https?:\/\/.+\.(png|jpe?g|gif|webp)(\?|$)/i.test(s)) return s;
  }

  return undefined;
}
