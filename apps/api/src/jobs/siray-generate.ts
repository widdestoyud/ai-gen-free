import { AppError, ErrorCodes } from "@ai-gen-free/core";

/** Slug URL /generate/siray/:slug → modelId katalog. Model baru = baris di sini + seed, bukan handler baru. */
export const SIRAY_GENERATE_SLUGS: Record<string, { modelId: string; defaultParams?: Record<string, unknown> }> = {
  "gpt-image-2-t2i": {
    modelId: "openai/gpt-image-2-t2i",
  },
  "seedream-5.0-pro-t2i-spicy": {
    modelId: "bytedance/seedream-5.0-pro-t2i-spicy",
    defaultParams: { size: "1024x1024", output_format: "png" },
  },
};

export function resolveSirayGenerateSlug(slug: string): { modelId: string; defaultParams: Record<string, unknown> } {
  const key = slug.trim();
  const row = SIRAY_GENERATE_SLUGS[key];
  if (!row) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Model Siray tidak tersedia");
  }
  return { modelId: row.modelId, defaultParams: { ...(row.defaultParams ?? {}) } };
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
    aspectRatio: body.aspectRatio ?? body.aspect_ratio,
  };
}
