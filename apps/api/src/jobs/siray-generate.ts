import { AppError, ErrorCodes } from "@ai-gen-free/core";

/** Slug URL /generate/siray/:slug → modelId katalog. Model baru = baris di sini + seed, bukan handler baru. */
export const SIRAY_GENERATE_SLUGS: Record<string, { modelId: string; mode?: "t2i" | "i2i" | "t2v" | "i2v"; defaultParams?: Record<string, unknown> }> = {
  "gpt-image-2-t2i": {
    modelId: "openai/gpt-image-2-t2i",
    mode: "t2i",
  },
  "gpt-image-2-edit": {
    modelId: "openai/gpt-image-2-edit",
    mode: "i2i",
  },
  "seedream-5.0-pro-t2i-spicy": {
    modelId: "bytedance/seedream-5.0-pro-t2i-spicy",
    mode: "t2i",
    defaultParams: { size: "1024x1024", output_format: "png" },
  },
  "qwen-image-3-edit-spicy": {
    modelId: "alibaba/qwen-image-3-edit-spicy",
    mode: "i2i",
    defaultParams: { size: "1k", aspectRatio: "1:1", prompt_expansion_enable: true },
  },
  "seedance-2.5-i2v": {
    modelId: "bytedance/seedance-2.5-i2v",
    mode: "i2v",
    defaultParams: { resolution: "480", duration: 6 },
  },
  "seedance-2.0-i2v-spicy": {
    modelId: "bytedance/seedance-2.0-i2v-spicy",
    mode: "i2v",
    defaultParams: { resolution: "480", duration: 6 },
  },
  "seedance-2.5-i2v-spicy": {
    modelId: "bytedance/seedance-2.5-i2v-spicy",
    mode: "i2v",
    defaultParams: { resolution: "480", duration: 6 },
  },
  "wan-2.7-i2v-uncensored": {
    modelId: "alibaba/wan-2.7-i2v-uncensored",
    mode: "i2v",
    defaultParams: { resolution: "480", duration: 6 },
  },
};

export function resolveSirayGenerateSlug(slug: string): { modelId: string; mode: "t2i" | "i2i" | "t2v" | "i2v"; defaultParams: Record<string, unknown> } {
  const key = slug.trim();
  const row = SIRAY_GENERATE_SLUGS[key];
  if (!row) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Model Siray tidak tersedia");
  }
  return { modelId: row.modelId, mode: row.mode ?? "t2i", defaultParams: { ...(row.defaultParams ?? {}) } };
}

export function sirayGenerateParamsFromBody(
  body: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...defaults,
    n: body.n,
    output_format: body.output_format ?? body.outputFormat ?? defaults.output_format,
    quality: body.quality,
    size: body.size ?? defaults.size,
    moderation: body.moderation,
    aspectRatio: body.aspectRatio ?? body.aspect_ratio ?? defaults.aspectRatio,
    image: body.image,
    images: body.images,
    refs: body.refs,
    mask: body.mask,
    duration: body.duration ?? defaults.duration,
    resolution: body.resolution ?? defaults.resolution,
    seed: body.seed ?? defaults.seed,
    prompt_expansion_enable: body.prompt_expansion_enable ?? defaults.prompt_expansion_enable,
  };
}
