"use client";

import type { Edge } from "@xyflow/react";
import type { NodeOutput } from "./store";

/**
 * For each edge from another node's **video out** to this node's `first_frame` or `last_frame`,
 * decode a JPEG data URL from that video (browser canvas) so it can be sent as `input_references`.
 */
export async function resolveVideoFrameRefsFromEdges(
  nodeId: string,
  edges: Edge[],
  nodeOutputs: Record<string, NodeOutput>
): Promise<Array<{ handle: string; url: string }>> {
  const results: Array<{ handle: string; url: string }> = [];
  for (const edge of edges.filter((e) => e.target === nodeId)) {
    const th = edge.targetHandle || "";
    if (th !== "first_frame" && th !== "last_frame") continue;
    if (edge.sourceHandle !== "video_url") continue;
    const out = nodeOutputs[edge.source];
    const videoUrl = out?.video_url;
    if (!videoUrl) continue;
    const which = th === "first_frame" ? "first" : "last";
    const url = await extractVideoFrameAsDataUrl(videoUrl, which);
    results.push({ handle: th, url });
  }
  return results;
}

/**
 * Grab first or last frame from a same-origin or CORS-allowed video URL as a JPEG data URL,
 * for OpenRouter `input_references` (image-to-video / extend).
 */
export async function extractVideoFrameAsDataUrl(
  videoUrl: string,
  which: "first" | "last"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.src = videoUrl;

    const fail = (msg: string) => {
      video.remove();
      reject(new Error(msg));
    };

    video.onloadedmetadata = () => {
      const d = video.duration;
      if (!d || !isFinite(d) || d <= 0) {
        fail("Could not read video duration");
        return;
      }
      if (which === "first") {
        video.currentTime = 0;
      } else {
        video.currentTime = Math.max(0, Math.min(d - 0.05, d - 1 / 30));
      }
    };

    video.onseeked = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) {
          fail("Invalid video dimensions");
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          fail("Canvas unsupported");
          return;
        }
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        video.remove();
        resolve(dataUrl);
      } catch (e) {
        video.remove();
        reject(e instanceof Error ? e : new Error("Frame extraction failed"));
      }
    };

    video.onerror = () => fail("Failed to load video (check URL / CORS)");
  });
}
