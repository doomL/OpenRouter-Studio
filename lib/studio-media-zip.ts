import type { Edge, Node } from "@xyflow/react";
import JSZip from "jszip";
import type { NodeOutput, VideoJob } from "@/lib/store";

function safeSegment(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);
}

function defaultNodeLabelByType(type: string): string {
  switch (type) {
    case "imageInput":
      return "Image Input";
    case "mediaInput":
      return "Media Input";
    case "imageGen":
      return "Image Generation";
    case "videoGen":
      return "Video Generation";
    case "llm":
      return "LLM Chat";
    case "prompt":
      return "Prompt";
    case "output":
      return "Output";
    case "note":
      return "Note";
    default:
      return "Node";
  }
}

function extFromDataUrl(url: string): string {
  const m = /^data:image\/(\w+);/i.exec(url);
  if (m) return m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase();
  if (/^data:video\/webm/i.test(url)) return "webm";
  if (/^data:video\/mp4/i.test(url)) return "mp4";
  if (/^data:video\//i.test(url)) return "mp4";
  return "bin";
}

function guessExtFromUrl(url: string): string {
  const lower = url.split("?")[0]?.toLowerCase() ?? "";
  if (lower.endsWith(".png") || lower.includes(".png")) return "png";
  if (lower.endsWith(".jpg") || lower.includes(".jpg")) return "jpg";
  if (lower.endsWith(".jpeg") || lower.includes(".jpeg")) return "jpg";
  if (lower.endsWith(".webp") || lower.includes(".webp")) return "webp";
  if (lower.endsWith(".gif") || lower.includes(".gif")) return "gif";
  if (lower.endsWith(".webm") || lower.includes(".webm")) return "webm";
  if (lower.endsWith(".mp4") || lower.includes(".mp4")) return "mp4";
  if (lower.includes("/video/") || lower.includes("video")) return "mp4";
  return "bin";
}

function decodeRawBase64(b64: string): Uint8Array | null {
  try {
    const binary = atob(b64.replace(/\s/g, ""));
    const out = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) out[j] = binary.charCodeAt(j);
    return out;
  } catch {
    return null;
  }
}

async function fetchMediaBytes(
  url: string,
  apiKey: string
): Promise<Uint8Array | null> {
  if (url.startsWith("data:")) {
    const i = url.indexOf("base64,");
    if (i === -1) return null;
    return decodeRawBase64(url.slice(i + 7));
  }

  if (url.startsWith("blob:")) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  const headers: Record<string, string> = {};
  if (
    apiKey &&
    (url.startsWith("/api/") || url.includes("/api/openrouter/"))
  ) {
    headers["x-api-key"] = apiKey;
  }

  try {
    const res = await fetch(url, {
      credentials: url.startsWith("/") ? "include" : "omit",
      headers,
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function getOutputNodeUpstreamMedia(
  outputNodeId: string,
  edges: Edge[],
  nodeOutputs: Record<string, NodeOutput>
): { images: string[]; videos: string[] } {
  const images: string[] = [];
  const videos: string[] = [];
  for (const edge of edges) {
    if (edge.target !== outputNodeId) continue;
    const src = nodeOutputs[edge.source];
    if (!src) continue;
    const th = edge.targetHandle || "";
    if (th === "image_url" && src.image_url) images.push(src.image_url);
    if (th === "video_url" && src.video_url) videos.push(src.video_url);
  }
  return { images, videos };
}

function getNodeFileBase(node: Node): string {
  const d = (node.data || {}) as Record<string, unknown>;
  const customLabel =
    typeof d.label === "string" ? d.label.trim() : "";
  if (customLabel.length > 0) return safeSegment(customLabel);
  return safeSegment(defaultNodeLabelByType(node.type ?? ""));
}

export interface BuildStudioMediaZipResult {
  blob: Blob;
  fileCount: number;
}

export interface StudioMediaZipOptions {
  includeInputNodes: boolean;
  includeImageGenNodes: boolean;
  includeVideoGenNodes: boolean;
  includeOutputNodes: boolean;
}

const DEFAULT_STUDIO_MEDIA_ZIP_OPTIONS: StudioMediaZipOptions = {
  includeInputNodes: true,
  includeImageGenNodes: true,
  includeVideoGenNodes: true,
  includeOutputNodes: true,
};

/**
 * Collects images and videos from canvas nodes (inputs, generators, jobs, output previews)
 * and returns a single ZIP blob. Duplicate URLs are included once.
 */
export async function buildStudioMediaZip(
  nodes: Node[],
  edges: Edge[],
  nodeOutputs: Record<string, NodeOutput>,
  videoJobs: Record<string, VideoJob>,
  apiKey: string,
  options: Partial<StudioMediaZipOptions> = {}
): Promise<BuildStudioMediaZipResult> {
  const resolvedOptions: StudioMediaZipOptions = {
    ...DEFAULT_STUDIO_MEDIA_ZIP_OPTIONS,
    ...options,
  };
  const zip = new JSZip();
  const seen = new Set<string>();
  let index = 0;
  let fileCount = 0;

  const addBytes = (bytes: Uint8Array, label: string, ext: string) => {
    index += 1;
    fileCount += 1;
    const name = `${String(index).padStart(3, "0")}-${label}.${ext}`;
    zip.file(name, bytes);
  };

  const addUrl = async (url: string | undefined, label: string) => {
    if (!url || url.length < 8 || seen.has(url)) return;
    seen.add(url);
    const bytes = await fetchMediaBytes(url, apiKey);
    if (!bytes || bytes.length === 0) return;
    const ext = url.startsWith("data:")
      ? extFromDataUrl(url)
      : guessExtFromUrl(url);
    addBytes(bytes, label, ext);
  };

  const addRawBase64IfNeeded = (
    b64: string | undefined,
    nodeId: string,
    kind: string
  ) => {
    if (!b64 || b64.length < 32) return;
    const key = `raw64:${nodeId}:${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    const bytes = decodeRawBase64(b64);
    if (!bytes || bytes.length === 0) return;
    addBytes(bytes, `${safeSegment(nodeId)}-${kind}`, "png");
  };

  for (const node of nodes) {
    const sid = getNodeFileBase(node);
    const d = (node.data || {}) as Record<string, unknown>;
    const out = nodeOutputs[node.id];
    const type = node.type ?? "";

    switch (type) {
      case "imageInput": {
        if (!resolvedOptions.includeInputNodes) break;
        const preview = (d.imagePreview || d.imageUrl) as string | undefined;
        await addUrl(preview, `${sid}-input`);
        if (out?.image_url) await addUrl(out.image_url, `${sid}-out`);
        else addRawBase64IfNeeded(out?.image_base64, node.id, "b64");
        break;
      }
      case "mediaInput": {
        if (!resolvedOptions.includeInputNodes) break;
        const mediaType = d.mediaType as string | undefined;
        if (mediaType === "image") {
          await addUrl(d.preview as string | undefined, `${sid}-media`);
        }
        if (mediaType === "video") {
          await addUrl(d.preview as string | undefined, `${sid}-preview`);
          await addUrl(d.videoDataUrl as string | undefined, `${sid}-videodata`);
        }
        if (out?.image_url) await addUrl(out.image_url, `${sid}-img-out`);
        else if (mediaType === "image")
          addRawBase64IfNeeded(out?.image_base64, node.id, "b64");
        if (out?.video_url) await addUrl(out.video_url, `${sid}-vid-out`);
        break;
      }
      case "imageGen": {
        if (!resolvedOptions.includeImageGenNodes) break;
        await addUrl(d.generatedImage as string | undefined, `${sid}-generated`);
        if (out?.image_url) await addUrl(out.image_url, `${sid}-out`);
        break;
      }
      case "videoGen": {
        if (!resolvedOptions.includeVideoGenNodes) break;
        if (out?.video_url) await addUrl(out.video_url, `${sid}-video`);
        const job = videoJobs[node.id];
        await addUrl(job?.videoUrl, `${sid}-job-url`);
        break;
      }
      case "output": {
        if (!resolvedOptions.includeOutputNodes) break;
        const { images, videos } = getOutputNodeUpstreamMedia(
          node.id,
          edges,
          nodeOutputs
        );
        for (let i = 0; i < images.length; i++) {
          await addUrl(images[i], `${sid}-out-img-${i + 1}`);
        }
        for (let i = 0; i < videos.length; i++) {
          await addUrl(videos[i], `${sid}-out-vid-${i + 1}`);
        }
        break;
      }
      default: {
        if (out?.image_url) await addUrl(out.image_url, `${sid}-img`);
        if (out?.video_url) await addUrl(out.video_url, `${sid}-vid`);
        if (!out?.image_url)
          addRawBase64IfNeeded(out?.image_base64, node.id, "b64");
      }
    }
  }

  if (fileCount === 0) {
    throw new Error(
      "No downloadable images or videos on the canvas (expired blob URLs, empty canvas, or fetch blocked)."
    );
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, fileCount };
}
