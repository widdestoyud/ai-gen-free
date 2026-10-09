import { AppError, ErrorCodes } from "@ai-gen-free/core";
import type { Prisma } from "@prisma/client";

const ASPECT_RATIOS = new Set(["1:1", "16:9", "9:16", "3:2", "2:3", "4:5", "5:4", "3:4", "4:3"]);

export function parseGenerateParams(raw: unknown, providerId: string): Prisma.InputJsonValue {
  if (raw === undefined || raw === null) {
    return { aspectRatio: "1:1" };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "params harus objek");
  }
  const input = raw as Record<string, unknown>;
  const params: Record<string, unknown> = {};

  if (input.aspectRatio !== undefined) {
    if (typeof input.aspectRatio !== "string" || !ASPECT_RATIOS.has(input.aspectRatio)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "aspectRatio tidak didukung");
    }
    params.aspectRatio = input.aspectRatio;
  } else if (!input.size) {
    params.aspectRatio = "1:1";
  }

  if (typeof input.size === "string") params.size = input.size;
  if (typeof input.image_size === "string" || (typeof input.image_size === "object" && input.image_size !== null)) {
    params.image_size = input.image_size;
  }
  if (typeof input.imageSize === "string" || (typeof input.imageSize === "object" && input.imageSize !== null)) {
    params.image_size = input.imageSize;
  }
  if (typeof input.tierSize === "string") params.tierSize = input.tierSize;
  if (typeof input.quality === "string") params.quality = input.quality;
  if (typeof input.output_format === "string") params.output_format = input.output_format;
  if (typeof input.outputFormat === "string") params.outputFormat = input.outputFormat;
  if (typeof input.moderation === "string") params.moderation = input.moderation;
  if (typeof input.n === "number") params.n = input.n;
  if (typeof input.seed === "number") params.seed = input.seed;
  if (typeof input.prompt_expansion_enable === "boolean") params.prompt_expansion_enable = input.prompt_expansion_enable;

  if (Array.isArray(input.refs)) {
    params.refs = input.refs.filter((r) => typeof r === "string" || (typeof r === "object" && r !== null));
  }
  if (typeof input.image === "string") params.image = input.image;
  if (Array.isArray(input.images)) {
    params.images = input.images.filter((img) => typeof img === "string");
  }
  if (typeof input.mask === "string") params.mask = input.mask;
  if (typeof input.mask_url === "string") params.mask_url = input.mask_url;
  if (typeof input.maskUrl === "string") params.mask_url = input.maskUrl;
  if (typeof input.maskDataUrl === "string") params.maskDataUrl = input.maskDataUrl;
  if (typeof input.strength === "number") params.strength = input.strength;
  if (typeof input.guidance_scale === "number") params.guidance_scale = input.guidance_scale;
  if (typeof input.guidanceScale === "number") params.guidance_scale = input.guidanceScale;
  if (typeof input.num_inference_steps === "number") params.num_inference_steps = input.num_inference_steps;
  if (typeof input.steps === "number") params.num_inference_steps = input.steps;
  if (typeof input.duration === "string" || typeof input.duration === "number") params.duration = input.duration;
  if (typeof input.resolution === "string" || typeof input.resolution === "number") params.resolution = String(input.resolution);
  if (typeof input.negative_prompt === "string") params.negative_prompt = input.negative_prompt;
  if (typeof input.negativePrompt === "string") params.negative_prompt = input.negativePrompt;
  if (typeof input.audio_enable === "boolean") params.audio_enable = input.audio_enable;
  if (typeof input.audioEnable === "boolean") params.audio_enable = input.audioEnable;

  // Upscaler parameters
  if (typeof input.upscale_mode === "string") params.upscale_mode = input.upscale_mode;
  if (typeof input.upscaleMode === "string") params.upscale_mode = input.upscaleMode;
  if (typeof input.upscale_factor === "number") params.upscale_factor = Math.min(Math.max(input.upscale_factor, 1), 4);
  if (typeof input.upscaleFactor === "number") params.upscale_factor = Math.min(Math.max(input.upscaleFactor, 1), 4);
  if (typeof input.target_resolution === "string") params.target_resolution = input.target_resolution;
  if (typeof input.targetResolution === "string") params.target_resolution = input.targetResolution;
  if (typeof input.noise_scale === "number") params.noise_scale = input.noise_scale;
  if (typeof input.noiseScale === "number") params.noise_scale = input.noiseScale;

  // Fal.ai and LoRA-specific parameters
  if (Array.isArray(input.loras)) {
    params.loras = input.loras;
  }
  if (typeof input.lora === "string" || (typeof input.lora === "object" && input.lora !== null)) {
    params.lora = input.lora;
  }
  if (typeof input.lora_url === "string") params.lora_url = input.lora_url;
  if (typeof input.loraUrl === "string") params.lora_url = input.loraUrl;
  if (typeof input.lora_path === "string") params.lora_path = input.lora_path;
  if (typeof input.loraPath === "string") params.lora_path = input.loraPath;
  if (typeof input.lora_scale === "number") params.lora_scale = input.lora_scale;
  if (typeof input.loraScale === "number") params.lora_scale = input.loraScale;
  if (typeof input.enable_safety_checker === "boolean") params.enable_safety_checker = input.enable_safety_checker;
  else if (typeof input.enableSafetyChecker === "boolean") params.enable_safety_checker = input.enableSafetyChecker;
  else if (providerId === "falai") params.enable_safety_checker = false;
  if (typeof input.creativity === "number" || typeof input.creativity === "string") params.creativity = input.creativity;
  if (typeof input.style === "string") params.style = input.style;

  if (providerId === "dummy" && input.fail === true) {
    params.fail = true;
  }
  return params as Prisma.InputJsonValue;
}
