export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing?: {
    prompt: string;
    completion: string;
    image?: string;
  };
  /** Human-readable price label extracted from pricing_json for image/video models */
  priceLabel?: string;
  context_length?: number;
  /** From OpenRouter `output_modalities` — used to pick correct image generation `modalities` */
  output_modalities?: string[];
}

/**
 * Always request only image output for image generation requests.
 * Sending "text" in modalities allows models like Gemini to return a text-only
 * fallback response (e.g. a hint or explanation) instead of generating an image.
 */
export function modalitiesForImageRequest(_outputModalities: string[] | undefined): string[] {
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

  const seenImage = new Set<string>();
  const seenVideo = new Set<string>();

  for (const raw of models) {
    const slug = (raw.slug as string) || "";
    const name = (raw.name as string) || (raw.short_name as string) || slug;
    const outputMods = (raw.output_modalities as string[]) || [];
    const contextLength = (raw.context_length as number) || 0;

    // Extract pricing from endpoint
    const endpoint = raw.endpoint as Record<string, unknown> | undefined;
    const epPricing = endpoint?.pricing as Record<string, string> | undefined;
    const pricingJson = endpoint?.pricing_json as Record<string, unknown> | undefined;

    const pricing = epPricing
      ? {
          prompt: epPricing.prompt || "0",
          completion: epPricing.completion || "0",
        }
      : undefined;

    const priceLabel = extractGenPrice(pricingJson);

    const model: OpenRouterModel = {
      id: slug,
      name,
      description: (raw.description as string) || undefined,
      pricing,
      priceLabel,
      context_length: contextLength,
      output_modalities: outputMods.length ? [...outputMods] : undefined,
    };

    if (outputMods.includes("text")) {
      text.push(model);
    }

    if (outputMods.includes("image") && !seenImage.has(slug)) {
      image.push(model);
      seenImage.add(slug);
    }

    if (outputMods.includes("video") && !seenVideo.has(slug)) {
      video.push(model);
      seenVideo.add(slug);
    }
  }

  return { text, image, video };
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
