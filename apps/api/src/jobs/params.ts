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
  if (typeof input.duration === "string" || typeof input.duration === "number") params.duration = input.duration;
  if (typeof input.resolution === "string" || typeof input.resolution === "number") params.resolution = String(input.resolution);
  if (typeof input.negative_prompt === "string") params.negative_prompt = input.negative_prompt;
  if (typeof input.negativePrompt === "string") params.negative_prompt = input.negativePrompt;

  if (providerId === "dummy" && input.fail === true) {
    params.fail = true;
  }
  return params as Prisma.InputJsonValue;
}
