import { NextRequest, NextResponse } from "next/server";
import { categorizeModels, type OpenRouterModel } from "@/lib/models";
import { fetchWithRetry, STUDIO_FETCH_MAX_ATTEMPTS } from "@/lib/fetch-with-retry";

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
    // Fetch text/image models from the frontend API and
    // video models from the dedicated v1 endpoint in parallel
    const [frontendRes, videoRes] = await Promise.all([
      fetchWithRetry(
        "https://openrouter.ai/api/frontend/models",
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
    ]);

    if (!frontendRes.ok) {
      const error = await frontendRes.text();
      throw new Error(`OpenRouter API error (${frontendRes.status}): ${error}`);
    }

    const json = await frontendRes.json();
    const models = json.data || json;
    const categorized = categorizeModels(Array.isArray(models) ? models : []);

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
            categorized.video.push(model);
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
