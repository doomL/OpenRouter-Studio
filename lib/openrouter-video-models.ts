/**
 * OpenRouter `/api/v1/videos/models` — authoritative per-model video constraints.
 * @see https://openrouter.ai/docs/guides/overview/multimodal/video-generation
 */
export type VideoGenerationCapabilities = {
  supported_aspect_ratios: string[];
  supported_resolutions: string[];
  supported_sizes: string[];
  supported_durations: number[];
  generate_audio: boolean;
  seed_supported: boolean;
  supported_frame_images: string[];
};

export type DerivedVideoUiParams = {
  durations: number[];
  resolutions: string[];
  aspectRatios: string[];
  sizes: string[];
  maxRefs: number;
  /** Provider supports an audio track toggle */
  audioCapability: boolean;
  seedSupported: boolean;
  /** True when constraints came from `/api/v1/videos/models` (not generic fallback). */
  fromApi: boolean;
};

const GENERIC_FALLBACK: DerivedVideoUiParams = {
  durations: [4, 6, 8],
  resolutions: ["720p", "1080p"],
  aspectRatios: ["16:9", "9:16"],
  sizes: [],
  maxRefs: 3,
  audioCapability: true,
  seedSupported: true,
  fromApi: false,
};

export function normalizeVideoModelId(id: string): string {
  const t = id.trim();
  return t.endsWith(":free") ? t.slice(0, -5) : t;
}

export function parseVideosModelsApiResponse(
  json: unknown
): Map<string, VideoGenerationCapabilities> {
  const map = new Map<string, VideoGenerationCapabilities>();
  const data = json && typeof json === "object" ? (json as { data?: unknown }).data : undefined;
  if (!Array.isArray(data)) return map;

  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    if (!id) continue;

    const aspect = o.supported_aspect_ratios;
    const res = o.supported_resolutions;
    const sizes = o.supported_sizes;
    const durs = o.supported_durations;
    const frames = o.supported_frame_images;
    const seedRaw = o.seed;

    map.set(id, {
      supported_aspect_ratios: Array.isArray(aspect)
        ? aspect.filter((x): x is string => typeof x === "string" && x.length > 0)
        : [],
      supported_resolutions: Array.isArray(res)
        ? res.filter((x): x is string => typeof x === "string" && x.length > 0)
        : [],
      supported_sizes: Array.isArray(sizes)
        ? sizes.filter((x): x is string => typeof x === "string" && x.length > 0)
        : [],
      supported_durations: Array.isArray(durs)
        ? durs.filter((x): x is number => typeof x === "number" && isFinite(x))
        : [],
      generate_audio: o.generate_audio === true,
      seed_supported: seedRaw === true,
      supported_frame_images: Array.isArray(frames)
        ? frames.filter((x): x is string => typeof x === "string" && x.length > 0)
        : [],
    });
  }
  return map;
}

export function lookupVideoCapabilities(
  byId: Map<string, VideoGenerationCapabilities>,
  modelId: string
): VideoGenerationCapabilities | undefined {
  if (!modelId) return undefined;
  if (byId.has(modelId)) return byId.get(modelId);
  const n = normalizeVideoModelId(modelId);
  if (byId.has(n)) return byId.get(n);
  return undefined;
}

export function enrichVideoModelsWithCapabilities<T extends { id: string }>(
  models: T[],
  byId: Map<string, VideoGenerationCapabilities>
): Array<T & { video_generation?: VideoGenerationCapabilities }> {
  return models.map((m) => {
    const cap = lookupVideoCapabilities(byId, m.id);
    return cap ? { ...m, video_generation: cap } : { ...m, video_generation: undefined };
  });
}

export function deriveVideoUiParams(
  cap: VideoGenerationCapabilities | undefined
): DerivedVideoUiParams {
  if (!cap) return { ...GENERIC_FALLBACK };

  const hasAny =
    cap.supported_aspect_ratios.length > 0 ||
    cap.supported_durations.length > 0 ||
    cap.supported_resolutions.length > 0 ||
    cap.supported_sizes.length > 0;

  if (!hasAny) {
    return { ...GENERIC_FALLBACK };
  }

  return {
    durations: cap.supported_durations.length
      ? [...new Set(cap.supported_durations)].sort((a, b) => a - b)
      : [...GENERIC_FALLBACK.durations],
    resolutions: cap.supported_resolutions.length
      ? cap.supported_resolutions
      : [...GENERIC_FALLBACK.resolutions],
    aspectRatios: cap.supported_aspect_ratios.length
      ? cap.supported_aspect_ratios
      : [...GENERIC_FALLBACK.aspectRatios],
    sizes: cap.supported_sizes.length ? cap.supported_sizes : [],
    maxRefs: GENERIC_FALLBACK.maxRefs,
    audioCapability: cap.generate_audio,
    seedSupported: cap.seed_supported,
    fromApi: true,
  };
}
