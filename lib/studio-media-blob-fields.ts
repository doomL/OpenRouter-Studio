/** Maps heavy `node.data` keys to persisted blob id fields (Prisma / S3). */
export type StudioBlobMediaFieldSpec = {
  dataKey: string;
  blobIdKey: string;
  kind: string;
  /** Minimum length before treating a raw base64 string as uploadable. */
  minRawBase64Length?: number;
};

export const STUDIO_BLOB_MEDIA_FIELDS: StudioBlobMediaFieldSpec[] = [
  { dataKey: "generatedImage", blobIdKey: "generatedImageBlobId", kind: "generatedImage" },
  { dataKey: "generatedAudio", blobIdKey: "generatedAudioBlobId", kind: "generatedAudio" },
  { dataKey: "preview", blobIdKey: "previewBlobId", kind: "preview" },
  { dataKey: "videoDataUrl", blobIdKey: "videoDataUrlBlobId", kind: "videoDataUrl" },
  { dataKey: "preKeyImage", blobIdKey: "preKeyImageBlobId", kind: "preKeyImage" },
  { dataKey: "outputImage", blobIdKey: "outputImageBlobId", kind: "outputImage" },
  {
    dataKey: "image_base64",
    blobIdKey: "imageBase64BlobId",
    kind: "image_base64",
    minRawBase64Length: 400,
  },
  { dataKey: "imageUrl", blobIdKey: "imageUrlBlobId", kind: "imageUrl" },
  { dataKey: "imagePreview", blobIdKey: "imagePreviewBlobId", kind: "imagePreview" },
];

const BASE64ish = /^[A-Za-z0-9+/=\s]+$/;

export function shouldUploadStudioMediaValue(
  spec: StudioBlobMediaFieldSpec,
  value: unknown
): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.startsWith("data:")) return value.length > 400;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/"))
    return false;
  if (value.startsWith("blob:")) return false;
  const min = spec.minRawBase64Length ?? 10_000;
  if (BASE64ish.test(value) && value.replace(/\s/g, "").length >= min) return true;
  return false;
}

export function parseDataUrlToBuffer(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const trimmed = dataUrl.trim();
  const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(trimmed);
  if (!m) return null;
  const mimeType = (m[1] && m[1].trim()) || "application/octet-stream";
  const isBase64 = Boolean(m[2]);
  const payload = m[3] ?? "";
  if (isBase64) {
    try {
      return {
        mimeType,
        buffer: Buffer.from(payload.replace(/\s/g, ""), "base64"),
      };
    } catch {
      return null;
    }
  }
  try {
    return { mimeType, buffer: Buffer.from(decodeURIComponent(payload), "utf8") };
  } catch {
    return null;
  }
}

export function rawBase64ToBuffer(b64: string): Buffer | null {
  try {
    return Buffer.from(b64.replace(/\s/g, ""), "base64");
  } catch {
    return null;
  }
}
