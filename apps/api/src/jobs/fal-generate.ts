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
    defaultParams: { upscale_mode: "factor", upscale_factor: 4.0 },
  },
  "image-edit": {
    modelId: "fal-ai/flux-lora/inpainting",
    mode: "inpaint",
    defaultParams: {},
  },
  "flux-lora/inpainting": {
    modelId: "fal-ai/flux-lora/inpainting",
    mode: "inpaint",
    defaultParams: {},
  },
  "flux-lora-inpainting": {
    modelId: "fal-ai/flux-lora/inpainting",
    mode: "inpaint",
    defaultParams: {},
  },
  "flux-inpainting": {
    modelId: "fal-ai/flux-lora/inpainting",
    mode: "inpaint",
    defaultParams: {},
  },
  "inpaint-qwen": {
    modelId: "fal-ai/flux-lora/inpainting",
    mode: "inpaint",
    defaultParams: {},
  },
  "inpaint-zit": {
    modelId: "fal-ai/flux-lora/inpainting",
    mode: "inpaint",
    defaultParams: {},
  },
  "qwen-inpaint": {
    modelId: "fal-ai/flux-lora/inpainting",
    mode: "inpaint",
    defaultParams: {},
  },
  "qwen-image-edit-inpaint": {
    modelId: "fal-ai/flux-lora/inpainting",
    mode: "inpaint",
    defaultParams: {},
  },
  "image-inpaint": {
    modelId: "fal-ai/flux-lora/inpainting",
    mode: "inpaint",
    defaultParams: {},
  },
};

export function resolveFalGenerateSlug(slug: string): {
  modelId: string;
  mode: "t2i" | "i2i" | "t2v" | "i2v" | "inpaint";
  defaultParams: Record<string, unknown>;
} {
  const key = slug.trim().toLowerCase();
  const row = FAL_GENERATE_SLUGS[key];
  if (row) {
    return { modelId: row.modelId, mode: (row.mode ?? "t2i") as any, defaultParams: { ...(row.defaultParams ?? {}) } };
  }

  // Fallback: If user provides full model id e.g. "krea-v2-large-text-to-image" or custom slug
  const normalized = slug.trim();
  if (
    normalized.includes("/") ||
    normalized.includes("krea") ||
    normalized.includes("fal-ai") ||
    normalized.includes("seedvr") ||
    normalized.includes("upscale") ||
    normalized.includes("inpaint") ||
    normalized.includes("image-edit") ||
    normalized.includes("flux") ||
    normalized.includes("qwen") ||
    normalized.includes("zit")
  ) {
    const isVideo = normalized.includes("video") || normalized.includes("i2v") || normalized.includes("t2v");
    const isInpaint =
      normalized.includes("inpaint") ||
      normalized.includes("image-edit") ||
      normalized.includes("zit") ||
      normalized.includes("qwen");
    const isI2i = normalized.includes("upscale") || normalized.includes("edit") || normalized.includes("i2i");
    const mode = isVideo ? "i2v" : isInpaint ? "inpaint" : isI2i ? "i2i" : "t2i";
    const modelId = isInpaint ? "fal-ai/flux-lora/inpainting" : normalized;
    return { modelId, mode, defaultParams: {} };
  }

  throw new AppError(ErrorCodes.VALIDATION_ERROR, `Model fal.ai '${slug}' tidak tersedia`);
}

export function falGenerateParamsFromBody(
  body: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const nested = (typeof body.params === "object" && body.params !== null ? body.params : {}) as Record<string, unknown>;
  const merged = { ...defaults, ...nested, ...body };

  const loras = merged.loras ?? defaults.loras;
  const loraUrl = merged.lora_url ?? merged.loraUrl ?? merged.lora_path ?? merged.loraPath ?? defaults.lora_url;
  const loraScale = merged.lora_scale ?? merged.loraScale ?? defaults.lora_scale;
  const lora = merged.lora ?? defaults.lora;

  return {
    ...defaults,
    n: merged.n ?? merged.num_images,
    aspectRatio: merged.aspectRatio ?? merged.aspect_ratio ?? defaults.aspectRatio,
    size: merged.size ?? merged.image_size ?? merged.imageSize ?? defaults.size,
    image_size: merged.image_size ?? merged.imageSize ?? merged.size ?? defaults.image_size,
    seed: merged.seed ?? defaults.seed,
    image: merged.image ?? merged.image_url ?? merged.imageUrl,
    images: merged.images,
    image_url: merged.image_url ?? merged.imageUrl ?? merged.image,
    mask: merged.mask ?? merged.mask_url ?? merged.maskUrl ?? merged.maskDataUrl,
    mask_url: merged.mask_url ?? merged.maskUrl ?? merged.mask ?? merged.maskDataUrl,
    maskDataUrl: merged.maskDataUrl ?? merged.mask ?? merged.mask_url,
    strength: merged.strength,
    guidance_scale: merged.guidance_scale ?? merged.guidanceScale,
    num_inference_steps: merged.num_inference_steps ?? merged.steps,
    refs: merged.refs,
    creativity: merged.creativity,
    style: merged.style,
    loras,
    lora,
    lora_url: loraUrl,
    lora_scale: loraScale,
    upscale_mode: merged.upscale_mode ?? merged.upscaleMode ?? defaults.upscale_mode,
    upscale_factor: merged.upscale_factor ?? merged.upscaleFactor ?? defaults.upscale_factor,
    target_resolution: merged.target_resolution ?? merged.targetResolution ?? defaults.target_resolution,
    noise_scale: merged.noise_scale ?? merged.noiseScale ?? defaults.noise_scale,
    output_format: merged.output_format ?? merged.outputFormat ?? defaults.output_format,
    enable_safety_checker:
      merged.enable_safety_checker ?? merged.enableSafetyChecker ?? defaults.enable_safety_checker ?? false,
    duration: merged.duration ?? defaults.duration,
    resolution: merged.resolution ?? defaults.resolution,
  };
}
