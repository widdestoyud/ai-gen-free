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
  const aspectRatio = input.aspectRatio === undefined ? "1:1" : input.aspectRatio;
  if (typeof aspectRatio !== "string" || !ASPECT_RATIOS.has(aspectRatio)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "aspectRatio tidak didukung");
  }
  const params: { aspectRatio: string; fail?: boolean } = { aspectRatio };
  if (providerId === "dummy" && input.fail === true) {
    params.fail = true;
  }
  return params;
}
