import { AppError, ErrorCodes } from "@ai-gen-free/core";

/** Slug URL /generate/falai/:slug → modelId katalog. */
export const FAL_GENERATE_SLUGS: Record<
  string,
  { modelId: string; mode?: "t2i" | "i2i" | "t2v" | "i2v"; defaultParams?: Record<string, unknown> }
> = {
  "krea-v2-large-t2i": {
    modelId: "krea/v2/large/text-to-image",
    mode: "t2i",
    defaultParams: { aspectRatio: "1:1" },
  },
  "krea-v2-large": {
    modelId: "krea/v2/large/text-to-image",
    mode: "t2i",
    defaultParams: { aspectRatio: "1:1" },
  },
  "krea-2-turbo-lora": {
    modelId: "fal-ai/krea-2/turbo/lora",
    mode: "t2i",
    defaultParams: { aspectRatio: "1:1" },
  },
  "krea-v2-turbo-lora": {
    modelId: "fal-ai/krea-2/turbo/lora",
    mode: "t2i",
    defaultParams: { aspectRatio: "1:1" },
  },
  "krea2-turbo-lora": {
    modelId: "fal-ai/krea-2/turbo/lora",
    mode: "t2i",
    defaultParams: { aspectRatio: "1:1" },
  },
  "krea-2-lora": {
    modelId: "fal-ai/krea-2/turbo/lora",
    mode: "t2i",
    defaultParams: { aspectRatio: "1:1" },
  },
  "krea2-lora": {
    modelId: "fal-ai/krea-2/turbo/lora",
    mode: "t2i",
    defaultParams: { aspectRatio: "1:1" },
  },
  "krea-v2-lora": {
    modelId: "fal-ai/krea-2/turbo/lora",
    mode: "t2i",
    defaultParams: { aspectRatio: "1:1" },
  },
  "krea2-saggy-lora": {
    modelId: "fal-ai/krea-2/turbo/lora",
    mode: "t2i",
    defaultParams: {
      aspectRatio: "1:1",
      loras: [
        {
          path: "https://pub-827c955ffb0145bab56ad1be9ae7dcff.r2.dev/lora/krea2/saggy-krea.safetensors",
          scale: 1.0,
        },
      ],
    },
  },
  "krea-2-saggy-lora": {
    modelId: "fal-ai/krea-2/turbo/lora",
    mode: "t2i",
    defaultParams: {
      aspectRatio: "1:1",
      loras: [
        {
          path: "https://pub-827c955ffb0145bab56ad1be9ae7dcff.r2.dev/lora/krea2/saggy-krea.safetensors",
          scale: 1.0,
        },
      ],
    },
  },
  "seedvr-upscale": {
    modelId: "fal-ai/seedvr/upscale/image",
    mode: "i2i",
    defaultParams: { upscale_mode: "factor", upscale_factor: 8.0 },
  },
};

export function resolveFalGenerateSlug(slug: string): {
  modelId: string;
  mode: "t2i" | "i2i" | "t2v" | "i2v";
  defaultParams: Record<string, unknown>;
} {
  const key = slug.trim().toLowerCase();
  const row = FAL_GENERATE_SLUGS[key];
  if (row) {
    return { modelId: row.modelId, mode: row.mode ?? "t2i", defaultParams: { ...(row.defaultParams ?? {}) } };
  }

  // Fallback: If user provides full model id e.g. "krea-v2-large-text-to-image" or custom slug
  const normalized = slug.trim();
  if (normalized.includes("/") || normalized.includes("krea") || normalized.includes("fal-ai") || normalized.includes("seedvr") || normalized.includes("upscale")) {
    const isVideo = normalized.includes("video") || normalized.includes("i2v") || normalized.includes("t2v");
    const isI2i = normalized.includes("upscale") || normalized.includes("edit") || normalized.includes("i2i");
    const mode = isVideo ? "i2v" : isI2i ? "i2i" : "t2i";
    return { modelId: normalized, mode, defaultParams: {} };
  }

  throw new AppError(ErrorCodes.VALIDATION_ERROR, `Model fal.ai '${slug}' tidak tersedia`);
}

export function falGenerateParamsFromBody(
  body: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const loras = body.loras ?? defaults.loras;
  const loraUrl = body.lora_url ?? body.loraUrl ?? body.lora_path ?? body.loraPath ?? defaults.lora_url;
  const loraScale = body.lora_scale ?? body.loraScale ?? defaults.lora_scale;
  const lora = body.lora ?? defaults.lora;

  return {
    ...defaults,
    n: body.n ?? body.num_images,
    aspectRatio: body.aspectRatio ?? body.aspect_ratio ?? defaults.aspectRatio,
    seed: body.seed ?? defaults.seed,
    image: body.image ?? body.image_url ?? body.imageUrl,
    images: body.images,
    image_url: body.image_url ?? body.imageUrl ?? body.image,
    refs: body.refs,
    creativity: body.creativity,
    style: body.style,
    loras,
    lora,
    lora_url: loraUrl,
    lora_scale: loraScale,
    upscale_mode: body.upscale_mode ?? body.upscaleMode ?? defaults.upscale_mode,
    upscale_factor: body.upscale_factor ?? body.upscaleFactor ?? defaults.upscale_factor,
    target_resolution: body.target_resolution ?? body.targetResolution ?? defaults.target_resolution,
    noise_scale: body.noise_scale ?? body.noiseScale ?? defaults.noise_scale,
    output_format: body.output_format ?? body.outputFormat ?? defaults.output_format,
    enable_safety_checker:
      body.enable_safety_checker ?? body.enableSafetyChecker ?? defaults.enable_safety_checker ?? false,
    duration: body.duration ?? defaults.duration,
    resolution: body.resolution ?? defaults.resolution,
  };
}
