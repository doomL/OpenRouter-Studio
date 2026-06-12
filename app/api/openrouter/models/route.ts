import { NextRequest, NextResponse } from "next/server";
import { categorizeModels, type OpenRouterModel } from "@/lib/models";
import { fetchWithRetry, STUDIO_FETCH_MAX_ATTEMPTS } from "@/lib/fetch-with-retry";
import {
  enrichVideoModelsWithCapabilities,
  parseVideosModelsApiResponse,
  type VideoGenerationCapabilities,
} from "@/lib/openrouter-video-models";

const COMMON_HEADERS = {
  "HTTP-Referer": "https://openrouter-studio.local",
  "X-Title": "OpenRouter Studio",
};

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  try {
    // Fetch text/image models from the public v1 API, video ids from v1, and
    // authoritative per-model constraints from the video models catalog (aspect ratios, durations, etc.).
    const [frontendRes, videoRes, videosMetaRes] = await Promise.all([
      fetchWithRetry(
        "https://openrouter.ai/api/v1/models",
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            ...COMMON_HEADERS,
          },
        },
        { maxAttempts: STUDIO_FETCH_MAX_ATTEMPTS }
      ),
      fetchWithRetry(
        "https://openrouter.ai/api/v1/models?output_modalities=video",
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            ...COMMON_HEADERS,
          },
        },
        { maxAttempts: STUDIO_FETCH_MAX_ATTEMPTS }
      ).catch(() => null), // Non-critical — fall back to frontend models if this fails
      fetchWithRetry("https://openrouter.ai/api/v1/videos/models", {
        headers: { ...COMMON_HEADERS },
      }).catch(() => null),
    ]);

    if (!frontendRes.ok) {
      const error = await frontendRes.text();
      throw new Error(`OpenRouter API error (${frontendRes.status}): ${error}`);
    }

    const json = await frontendRes.json();
    const rawModels: Record<string, unknown>[] = Array.isArray(json.data || json) ? (json.data || json) : [];
    // v1 models use `id` not `slug`, nest modalities under `architecture`, and have
    // `pricing` at root. Normalize to the shape categorizeModels expects.
    const models = rawModels.map((m) => {
      if (typeof m.slug === "string") return m; // already frontend format (future-proof)
      const arch = m.architecture as Record<string, unknown> | undefined;
      return {
        ...m,
        slug: m.id,
        input_modalities: arch?.input_modalities || [],
        output_modalities: arch?.output_modalities || [],
        endpoint: {
          model_variant_slug: m.id,
          pricing: m.pricing,
        },
      };
    });
    const categorized = categorizeModels(models);

    let videoCapsById = new Map<string, VideoGenerationCapabilities>();
    if (videosMetaRes?.ok) {
      try {
        const vmJson = await videosMetaRes.json();
        videoCapsById = parseVideosModelsApiResponse(vmJson);
      } catch {
        /* ignore */
      }
    }

    categorized.video = enrichVideoModelsWithCapabilities(categorized.video, videoCapsById);

    // Merge video models from the v1 endpoint (official source)
    if (videoRes?.ok) {
      try {
        const videoJson = await videoRes.json();
        const v1VideoModels = videoJson.data as Record<string, unknown>[] | undefined;
        if (Array.isArray(v1VideoModels)) {
          const existingIds = new Set(categorized.video.map((m) => m.id));
          for (const raw of v1VideoModels) {
            const id = (raw.id as string) || "";
            if (!id || existingIds.has(id)) continue;
            const name = (raw.name as string) || id;
            const pricing = raw.pricing as Record<string, string> | undefined;
            const model: OpenRouterModel = {
              id,
              name,
              description: (raw.description as string) || undefined,
              pricing: pricing
                ? { prompt: pricing.prompt || "0", completion: pricing.completion || "0" }
                : undefined,
              context_length: (raw.context_length as number) || 0,
              output_modalities: ["video"],
            };
            categorized.video.push(
              enrichVideoModelsWithCapabilities([model], videoCapsById)[0]
            );
          }
        }
      } catch {
        // Ignore parse errors — frontend models already provide video entries
      }
    }

    return NextResponse.json(categorized);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
