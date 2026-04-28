/** File extension for Content-Disposition / downloads. */
export function extensionForMime(mime: string): string {
  const m = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  if (m === "image/svg+xml") return "svg";
  if (m === "audio/wav" || m === "audio/x-wav") return "wav";
  if (m === "audio/mpeg") return "mp3";
  if (m === "audio/webm") return "webm";
  if (m === "audio/ogg") return "ogg";
  if (m === "video/mp4") return "mp4";
  if (m === "video/webm") return "webm";
  if (m === "video/quicktime") return "mov";
  return "bin";
}
