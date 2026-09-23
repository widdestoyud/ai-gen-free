import { prisma } from "@ai-gen-free/db";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import type { JobMode } from "@prisma/client";

const DISPLAY_FALLBACK: Record<string, string> = {
  "black-forest-labs/flux-1.1-pro-t2i": "Flux 1.1 Pro",
  "openai/gpt-image-2-t2i": "GPT Image 2",
  "openai/gpt-image-2-edit": "GPT Image 2 Edit",
  "bytedance/seedream-5.0-pro-t2i-spicy": "Seedream 5.0 Pro Spicy",
  "alibaba/qwen-image-3-edit-spicy": "Qwen Image 3 Edit Spicy",
  "bytedance/seedance-2.5-i2v": "Seedance 2.5 I2V",
  "bytedance/seedance-2.0-i2v-spicy": "Seedance 2.0 I2V Spicy",
  "bytedance/seedance-2.5-i2v-spicy": "Seedance 2.5 I2V Spicy",
  "alibaba/wan-2.7-i2v-uncensored": "Wan 2.7 I2V Uncensored",
  "dummy-t2i": "Dummy",
};

const VALID_MODES = new Set<string>(["t2i", "i2i", "t2v", "i2v"]);

function asInt(value: { toString(): string } | number): number {
  return typeof value === "number" ? value : Number(value);
}

export type VideoConfigPoints = {
  "6s_480p"?: number;
  "6s_720p"?: number;
  "6s_1080p"?: number;
  "10s_480p"?: number;
  "10s_720p"?: number;
  "10s_1080p"?: number;
  "15s_480p"?: number;
  "15s_720p"?: number;
  "15s_1080p"?: number;
  [key: string]: number | undefined;
};

export const DEFAULT_VIDEO_CONFIG_POINTS: Record<string, number> = {
  "6s_480p": 100,
  "6s_720p": 210,
  "6s_1080p": 500,
  "10s_480p": 155,
  "10s_720p": 345,
  "10s_1080p": 820,
  "15s_480p": 235,
  "15s_720p": 510,
  "15s_1080p": 1230,
};

export function normalizeVideoConfigKey(durationRaw: unknown, resolutionRaw: unknown): string {
  let dur = "6s";
  if (typeof durationRaw === "number") dur = `${durationRaw}s`;
  else if (typeof durationRaw === "string") {
    const d = durationRaw.trim().toLowerCase();
    dur = d.endsWith("s") ? d : `${d}s`;
  }

  let res = "480p";
  if (typeof resolutionRaw === "number") res = `${resolutionRaw}p`;
  else if (typeof resolutionRaw === "string") {
    const r = resolutionRaw.trim().toLowerCase();
    res = r.endsWith("p") ? r : `${r}p`;
  }

  return `${dur}_${res}`;
}

export function resolveVideoPointCost(
  durationRaw: unknown,
  resolutionRaw: unknown,
  customConfig?: VideoConfigPoints | null,
  fallbackCost = 100,
): number {
  const key = normalizeVideoConfigKey(durationRaw, resolutionRaw);
  if (customConfig && typeof customConfig[key] === "number" && (customConfig[key] as number) > 0) {
    return Number(customConfig[key]);
  }
  if (typeof DEFAULT_VIDEO_CONFIG_POINTS[key] === "number") {
    return DEFAULT_VIDEO_CONFIG_POINTS[key]!;
  }
  return fallbackCost > 0 ? fallbackCost : 100;
}

export type CatalogRow = {
  mode: JobMode;
  modelId: string;
  displayName: string;
  providerId: string;
  costPoints: number;
  videoConfigPoints?: VideoConfigPoints | null;
  isSpicy: boolean;
};

export function humanDisplayName(modelId: string, displayName?: string | null): string {
  const named = displayName?.trim();
  if (named) return named;
  return DISPLAY_FALLBACK[modelId] ?? modelId;
}

export function pickEnabledModel(rows: CatalogRow[], modeRaw: unknown, modelIdRaw: unknown): CatalogRow {
  if (typeof modeRaw !== "string" || !VALID_MODES.has(modeRaw)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Mode ini belum tersedia");
  }
  const mode = modeRaw as JobMode;
  const isVideo = mode === "t2v" || mode === "i2v";
  const forMode = rows.filter((row) => row.mode === mode || (isVideo && (row.mode === "t2v" || row.mode === "i2v")));
  if (typeof modelIdRaw === "string" && modelIdRaw.trim()) {
    const found = forMode.find((row) => row.modelId === modelIdRaw.trim());
    if (!found) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "Model tidak tersedia");
    }
    return { ...found, mode };
  }
  if (forMode.length === 1) return { ...forMode[0]!, mode };
  if (forMode.length === 0) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Tidak ada model aktif untuk mode ini");
  }
  throw new AppError(ErrorCodes.VALIDATION_ERROR, "Pilih model yang tersedia");
}

export async function listEnabledModels() {
  const rows = await prisma.modelCatalog.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    mode: row.mode,
    modelId: row.modelId,
    displayName: humanDisplayName(row.modelId, row.displayName),
    providerId: row.providerId,
    costPoints: asInt(row.costPoints),
    videoConfigPoints: (row.videoConfigPoints as VideoConfigPoints) ?? null,
    isSpicy: Boolean(row.isSpicy),
  }));
}

export async function resolveModel(modeRaw: unknown, modelIdRaw: unknown) {
  if (typeof modeRaw !== "string" || !VALID_MODES.has(modeRaw)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Mode ini belum tersedia");
  }
  const mode = modeRaw as JobMode;
  let rows = await prisma.modelCatalog.findMany({
    where: { mode, enabled: true },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0 && (mode === "t2v" || mode === "i2v")) {
    const altMode: JobMode = mode === "t2v" ? "i2v" : "t2v";
    rows = await prisma.modelCatalog.findMany({
      where: { mode: altMode, enabled: true },
      orderBy: { createdAt: "asc" },
    });
  }
  return pickEnabledModel(
    rows.map((row) => ({
      mode: row.mode,
      modelId: row.modelId,
      displayName: humanDisplayName(row.modelId, row.displayName),
      providerId: row.providerId,
      costPoints: asInt(row.costPoints),
      videoConfigPoints: (row.videoConfigPoints as VideoConfigPoints) ?? null,
      isSpicy: Boolean(row.isSpicy),
    })),
    modeRaw,
    modelIdRaw,
  );
}
