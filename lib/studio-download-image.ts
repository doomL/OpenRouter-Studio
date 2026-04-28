import { extensionForMime } from "@/lib/studio-blob-filename";

/** Safe base name for downloads (no path separators or reserved chars). */
export function sanitizeDownloadBaseName(raw: string, fallback: string): string {
  const t = raw.trim() || fallback;
  return t
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .slice(0, 80) || fallback;
}

/** Fetch image bytes and trigger a browser download with the given base name (extension from blob / data URL). */
export async function downloadImageFromSrc(
  imageSrc: string,
  preferredBaseName: string
): Promise<void> {
  const base = sanitizeDownloadBaseName(preferredBaseName, "image");
  let blob: Blob;
  let ext = "png";

  if (imageSrc.startsWith("data:")) {
    const m = /^data:([^;,]+)/.exec(imageSrc);
    if (m?.[1]) ext = extensionForMime(m[1]);
    const res = await fetch(imageSrc);
    blob = await res.blob();
  } else {
    const res = await fetch(imageSrc, { credentials: "include" });
    if (!res.ok) {
      throw new Error(`Download failed (HTTP ${res.status})`);
    }
    blob = await res.blob();
    const ct = res.headers.get("content-type");
    if (ct) ext = extensionForMime(ct);
    if (ext === "bin" && blob.type) ext = extensionForMime(blob.type);
  }

  const name = base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
