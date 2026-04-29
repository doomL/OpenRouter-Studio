import type { VideoGenerationCapabilities } from "./openrouter-video-models";

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing?: {
    prompt: string;
    completion: string;
    image?: string;
  };
  /** Shown in model dropdown — from `endpoint.pricing.display_pricing` when present, else pricing_json heuristics */
  priceLabel?: string;
  context_length?: number;
  /** From OpenRouter `output_modalities` — used to pick the correct canvas category */
  output_modalities?: string[];
  /** TTS voice ids from OpenRouter `supported_tts_voices` (playground list) */
  supported_tts_voices?: string[];
  /** From GET /api/v1/videos/models — aspect ratios, durations, resolutions, etc. */
  video_generation?: VideoGenerationCapabilities;
}

/**
 * Always request only image output for image generation requests.
 * Sending "text" in modalities allows models like Gemini to return a text-only
 * fallback response (e.g. a hint or explanation) instead of generating an image.
 */
export function modalitiesForImageRequest(): string[] {
  return ["image"];
}

/**
 * Extract a human-readable price from pricing_json for image/video models.
 * These models charge per-generation, not per-token.
 */
function extractGenPrice(pricingJson: Record<string, unknown> | undefined): string | undefined {
  if (!pricingJson) return undefined;

  // Video: per-second pricing
  for (const [key, val] of Object.entries(pricingJson)) {
    if (key.includes("duration_seconds") && !key.includes("with_") && !key.includes("without_")) {
      const num = parseFloat(String(val));
      if (!isNaN(num) && num > 0) return `$${num.toFixed(2)}/sec`;
    }
  }
  // Video fallback: any duration_seconds key
  for (const [key, val] of Object.entries(pricingJson)) {
    if (key.includes("duration_seconds")) {
      const num = parseFloat(String(val));
      if (!isNaN(num) && num > 0) return `$${num.toFixed(2)}/sec`;
    }
  }
  // Video: video_tokens — estimate per-second cost
  // e.g., Seedance: "seedance:video_tokens": "0.0000012" → ~$0.026/sec empirically
  for (const [key, val] of Object.entries(pricingJson)) {
    if (key.includes("video_tokens")) {
      const num = parseFloat(String(val));
      if (!isNaN(num) && num > 0) {
        const perM = num * 1_000_000;
        return `~$${perM.toFixed(1)}/M vtok`;
      }
    }
  }

  // Image: cents per image output
  for (const [key, val] of Object.entries(pricingJson)) {
    if (key.includes("cents_per_image_output") && !key.includes("2k") && !key.includes("4k")) {
      const cents = parseFloat(String(val));
      if (!isNaN(cents) && cents > 0) return `$${(cents / 100).toFixed(2)}/img`;
    }
  }
  // Image: upstream cost cents (Flux)
  for (const [key, val] of Object.entries(pricingJson)) {
    if (key.includes("upstream_cost_cents")) {
      const cents = parseFloat(String(val));
      if (!isNaN(cents) && cents > 0) return `$${(cents / 100).toFixed(2)}/img`;
    }
  }
  // Image: per-token with image_output_tokens (Gemini)
  for (const [key, val] of Object.entries(pricingJson)) {
    if (key.includes("image_output_tokens")) {
      const num = parseFloat(String(val));
      if (!isNaN(num) && num > 0) {
        const perM = num * 1_000_000;
        return `$${perM.toFixed(0)}/M itok`;
      }
    }
  }

  // Audio / music: per-unit generation (e.g. Lyria) — token fields are 0 but pricing_json bills per song
  for (const [key, val] of Object.entries(pricingJson)) {
    if (key.includes("song_generation")) {
      const num = parseFloat(String(val));
      if (!isNaN(num) && num > 0) return `$${num.toFixed(2)}/song`;
    }
  }

  return undefined;
}

type DisplayPricingItem = {
  kind?: string;
  sku_label?: string;
  price?: string | number;
  displayMultiplier?: number;
  unitLabel?: string;
};

/**
 * OpenRouter includes `endpoint.pricing.display_pricing` with unit + token rows.
 * Prefer this over raw prompt=0 so Lyria-style models don't show as "free".
 */
function priceLabelFromDisplayPricing(displayPricing: unknown): string | undefined {
  if (!Array.isArray(displayPricing) || displayPricing.length === 0) return undefined;

  const items = displayPricing.filter(
    (x): x is DisplayPricingItem => Boolean(x) && typeof x === "object"
  );
  if (items.length === 0) return undefined;

  const formatUnitLine = (item: DisplayPricingItem): string | undefined => {
    const p = parseFloat(String(item.price ?? ""));
    if (isNaN(p) || p <= 0) return undefined;
    const rawUnit = typeof item.unitLabel === "string" ? item.unitLabel.trim() : "";
    const suffix = rawUnit.replace(/^per\s+/i, "/").replace(/\s+/g, "") || "";
    return suffix.startsWith("/") ? `$${p}${suffix}` : `$${p}/${suffix}`;
  };

  const formatTokenLine = (item: DisplayPricingItem): string | undefined => {
    const p = parseFloat(String(item.price ?? ""));
    if (isNaN(p) || p < 0) return undefined;
    const mult =
      typeof item.displayMultiplier === "number" && item.displayMultiplier > 0
        ? item.displayMultiplier
        : 1_000_000;
    const perM = p * mult;
    if (perM === 0) return "free";
    if (perM < 0) return "varies";
    if (perM < 0.01) return "<$0.01/M";
    if (perM < 1) return `$${perM.toFixed(2)}/M`;
    return `$${perM.toFixed(1)}/M`;
  };

  const unitItems = items.filter((i) => i.kind === "unit");
  for (const item of unitItems) {
    const s = formatUnitLine(item);
    if (s) return s;
  }

  const tokenItems = items.filter((i) => i.kind === "token");
  if (tokenItems.length > 0) {
    const inputFirst = tokenItems.find((i) =>
      String(i.sku_label ?? "")
        .toLowerCase()
        .includes("input")
    );
    const item = inputFirst ?? tokenItems[0];
    const s = formatTokenLine(item);
    if (s) return s;
  }

  return undefined;
}

/**
 * Categorize models from the OpenRouter frontend API.
 * Each model has `output_modalities` (string[]) and `input_modalities` (string[]).
 * Pricing lives under `endpoint.pricing` (per-token) and `endpoint.pricing_json` (per-gen).
 * The model ID is `slug`.
 */
export function categorizeModels(models: Record<string, unknown>[]) {
  const text: OpenRouterModel[] = [];
  const image: OpenRouterModel[] = [];
  const video: OpenRouterModel[] = [];
  const audio: OpenRouterModel[] = [];
  const transcribe: OpenRouterModel[] = [];

  const seenImage = new Set<string>();
  const seenVideo = new Set<string>();
  const seenAudio = new Set<string>();
  const seenTranscribe = new Set<string>();

  for (const raw of models) {
    const slug = (raw.slug as string) || "";
    const name = (raw.name as string) || (raw.short_name as string) || slug;
    const inputMods = (raw.input_modalities as string[]) || [];
    const outputMods = (raw.output_modalities as string[]) || [];
    const contextLength = (raw.context_length as number) || 0;

    // Extract pricing from endpoint
    const endpoint = raw.endpoint as Record<string, unknown> | undefined;
    // OpenRouter chat/API expects `model_variant_slug` (e.g. vendor/model:free), not the
    // top-level `slug` alone — free tiers 404 without the :free suffix.
    const id =
      (endpoint?.model_variant_slug as string | undefined)?.trim() || slug;
    const epPricing = endpoint?.pricing as Record<string, unknown> | undefined;
    const pricingJson = endpoint?.pricing_json as Record<string, unknown> | undefined;

    const promptStr =
      epPricing && typeof epPricing.prompt === "string" ? epPricing.prompt : "0";
    const completionStr =
      epPricing && typeof epPricing.completion === "string" ? epPricing.completion : "0";

    const pricing = epPricing
      ? {
          prompt: promptStr || "0",
          completion: completionStr || "0",
        }
      : undefined;

    const displayPricing = epPricing?.display_pricing;
    const priceLabel =
      priceLabelFromDisplayPricing(displayPricing) ?? extractGenPrice(pricingJson);

    const ttsVoicesRaw = raw.supported_tts_voices;
    const supported_tts_voices = Array.isArray(ttsVoicesRaw)
      ? ttsVoicesRaw.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : undefined;

    const model: OpenRouterModel = {
      id,
      name,
      description: (raw.description as string) || undefined,
      pricing,
      priceLabel,
      context_length: contextLength,
      output_modalities: outputMods.length ? [...outputMods] : undefined,
      supported_tts_voices:
        supported_tts_voices && supported_tts_voices.length > 0
          ? supported_tts_voices
          : undefined,
    };

    if (outputMods.includes("text")) {
      text.push(model);
    }

    if (outputMods.includes("image") && !seenImage.has(id)) {
      image.push(model);
      seenImage.add(id);
    }

    if (outputMods.includes("video") && !seenVideo.has(id)) {
      video.push(model);
      seenVideo.add(id);
    }

    if (
      (outputMods.includes("audio") || outputMods.includes("speech")) &&
      !seenAudio.has(id)
    ) {
      audio.push(model);
      seenAudio.add(id);
    }

    const supportsTranscription =
      inputMods.includes("audio") &&
      (outputMods.includes("text") || outputMods.includes("transcription"));
    if (supportsTranscription && !seenTranscribe.has(id)) {
      transcribe.push(model);
      seenTranscribe.add(id);
    }
  }

  return { text, image, video, audio, transcribe };
}

/**
 * Format pricing for display.
 * Prices are per-token strings like "0.0000003".
 * Convert to $/M tokens for readability.
 */
export function formatPrice(pricePerToken: string | undefined): string {
  if (!pricePerToken) return "?";
  const num = parseFloat(pricePerToken);
  if (isNaN(num)) return "?";
  if (num === 0) return "free";
  if (num < 0) return "varies";
  const perMillion = num * 1_000_000;
  if (perMillion < 0.01) return "<$0.01/M";
  if (perMillion < 1) return `$${perMillion.toFixed(2)}/M`;
  return `$${perMillion.toFixed(1)}/M`;
}
