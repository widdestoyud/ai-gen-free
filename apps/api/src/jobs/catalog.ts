import { prisma } from "@ai-gen-free/db";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import type { JobMode } from "@prisma/client";

import { DEFAULT_FALLBACK_MODELS, DEFAULT_GENERATION_MODELS_KEY, type DefaultGenerationModelsConfig } from "../admin/parse.js";
import {
  getCachedAppSetting,
  setCachedAppSetting,
  getCachedCustomerCatalog,
  setCachedCustomerCatalog,
} from "../lib/cache.js";

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
  "fal-ai/flux-lora/inpainting": "Flux LoRA Inpainting",
  "fal-ai/qwen-image-edit/inpaint": "Qwen Image Edit Inpaint",
  "dummy-t2i": "Dummy",
};

const VALID_MODES = new Set<string>(["t2i", "i2i", "t2v", "i2v", "inpaint"]);

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

export type CustomerCatalogItem = {
  mode: JobMode;
  modelId: string;
  costPoints: number;
  videoConfigPoints?: VideoConfigPoints | null;
  isSpicy: boolean;
};

export function toOpaqueModelId(mode: string, rawModelId?: string, isSpicy?: boolean): string {
  if (rawModelId && rawModelId.includes("upscale")) {
    return "image-upscale";
  }
  if (rawModelId && (rawModelId.includes("inpaint") || rawModelId === "image-inpaint") || mode === "inpaint") {
    return "image-inpaint";
  }
  const spicy =
    typeof isSpicy === "boolean"
      ? isSpicy
      : Boolean(rawModelId && (rawModelId.includes("spicy") || rawModelId.includes("uncensored")));
  if (mode === "t2i") {
    return spicy ? "t2i-spicy" : "t2i-standard";
  }
  if (mode === "i2i") {
    return spicy ? "i2i-spicy" : "i2i-standard";
  }
  if (mode === "t2v" || mode === "i2v") {
    return spicy ? "video-spicy" : "video-standard";
  }
  return spicy ? `${mode}-spicy` : `${mode}-standard`;
}

export function getCustomerCatalogDefaults() {
  return {
    normalT2iModelId: "t2i-standard",
    normalI2iModelId: "i2i-standard",
    spicyT2iModelId: "t2i-spicy",
    spicyI2iModelId: "i2i-spicy",
    normalVideoModelId: "video-standard",
    spicyVideoModelId: "video-spicy",
    upscaleModelId: "image-upscale",
    inpaintModelId: "image-inpaint",
  };
}

export function humanDisplayName(modelId: string, displayName?: string | null): string {
  const named = displayName?.trim();
  if (named) return named;
  return DISPLAY_FALLBACK[modelId] ?? modelId;
}

export async function getActiveDefaultModels(): Promise<DefaultGenerationModelsConfig> {
  const cached = await getCachedAppSetting<DefaultGenerationModelsConfig>(DEFAULT_GENERATION_MODELS_KEY);
  if (cached) return cached;

  const row = await prisma.appSetting.findUnique({ where: { key: DEFAULT_GENERATION_MODELS_KEY } });
  const raw = row?.value as Partial<DefaultGenerationModelsConfig> | null | undefined;
  const config: DefaultGenerationModelsConfig = {
    normalT2iModelId:
      typeof raw?.normalT2iModelId === "string" && raw.normalT2iModelId.trim()
        ? raw.normalT2iModelId.trim()
        : DEFAULT_FALLBACK_MODELS.normalT2iModelId,
    normalI2iModelId:
      typeof raw?.normalI2iModelId === "string" && raw.normalI2iModelId.trim()
        ? raw.normalI2iModelId.trim()
        : DEFAULT_FALLBACK_MODELS.normalI2iModelId,
    spicyT2iModelId:
      typeof raw?.spicyT2iModelId === "string" && raw.spicyT2iModelId.trim()
        ? raw.spicyT2iModelId.trim()
        : DEFAULT_FALLBACK_MODELS.spicyT2iModelId,
    spicyI2iModelId:
      typeof raw?.spicyI2iModelId === "string" && raw.spicyI2iModelId.trim()
        ? raw.spicyI2iModelId.trim()
        : DEFAULT_FALLBACK_MODELS.spicyI2iModelId,
    normalVideoModelId:
      typeof raw?.normalVideoModelId === "string" && raw.normalVideoModelId.trim()
        ? raw.normalVideoModelId.trim()
        : DEFAULT_FALLBACK_MODELS.normalVideoModelId,
    spicyVideoModelId:
      typeof raw?.spicyVideoModelId === "string" && raw.spicyVideoModelId.trim()
        ? raw.spicyVideoModelId.trim()
        : DEFAULT_FALLBACK_MODELS.spicyVideoModelId,
    inpaintModelId:
      typeof raw?.inpaintModelId === "string" && raw.inpaintModelId.trim()
        ? raw.inpaintModelId.trim()
        : DEFAULT_FALLBACK_MODELS.inpaintModelId,
  };
  void setCachedAppSetting(DEFAULT_GENERATION_MODELS_KEY, config);
  return config;
}

export function pickEnabledModel(rows: CatalogRow[], modeRaw: unknown, modelIdRaw: unknown): CatalogRow {
  if (typeof modeRaw !== "string" || !VALID_MODES.has(modeRaw)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Mode ini belum tersedia");
  }
  const mode = modeRaw as JobMode;
  const isVideo = mode === "t2v" || mode === "i2v";
  const forMode = rows.filter((row) => row.mode === mode || (isVideo && (row.mode === "t2v" || row.mode === "i2v")));
  if (typeof modelIdRaw === "string" && modelIdRaw.trim()) {
    const raw = modelIdRaw.trim();
    const found = forMode.find(
      (row) =>
        row.modelId === raw ||
        (raw === "image-upscale" && row.modelId.includes("upscale")) ||
        (raw === "seedvr-upscale" && row.modelId.includes("upscale")),
    );
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

export async function listCustomerCatalog(): Promise<CustomerCatalogItem[]> {
  const cached = await getCachedCustomerCatalog<CustomerCatalogItem[]>();
  if (cached) return cached;

  const [rows, defaults] = await Promise.all([
    prisma.modelCatalog.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
    }),
    getActiveDefaultModels(),
  ]);

  const map = new Map<string, CustomerCatalogItem>();

  for (const row of rows) {
    const isSpicy = Boolean(row.isSpicy);
    const isUpscale = row.modelId.includes("upscale");
    const isInpaint = row.mode === "inpaint" || row.modelId.includes("inpaint");
    const opaqueId = isUpscale ? "image-upscale" : isInpaint ? "image-inpaint" : toOpaqueModelId(row.mode, row.modelId, isSpicy);
    const key = isUpscale ? "upscale" : isInpaint ? "inpaint" : `${row.mode}_${isSpicy ? "spicy" : "normal"}`;

    const isPreferred =
      (row.mode === "t2i" && !isSpicy && row.modelId === defaults.normalT2iModelId) ||
      (row.mode === "t2i" && isSpicy && row.modelId === defaults.spicyT2iModelId) ||
      (row.mode === "i2i" && !isUpscale && !isInpaint && !isSpicy && row.modelId === defaults.normalI2iModelId) ||
      (row.mode === "i2i" && !isUpscale && !isInpaint && isSpicy && row.modelId === defaults.spicyI2iModelId) ||
      ((row.mode === "t2v" || row.mode === "i2v") && !isSpicy && row.modelId === defaults.normalVideoModelId) ||
      ((row.mode === "t2v" || row.mode === "i2v") && isSpicy && row.modelId === defaults.spicyVideoModelId) ||
      isUpscale ||
      isInpaint;

    if (!map.has(key) || isPreferred) {
      map.set(key, {
        mode: row.mode,
        modelId: opaqueId,
        costPoints: asInt(row.costPoints),
        videoConfigPoints: (row.videoConfigPoints as VideoConfigPoints) ?? null,
        isSpicy,
      });
    }
  }

  const result = Array.from(map.values());
  void setCachedCustomerCatalog(result);
  return result;
}

export async function resolveModel(modeRaw: unknown, modelIdRaw: unknown, isSpicyRaw?: unknown) {
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

  const catalogRows: CatalogRow[] = rows.map((row) => ({
    mode: row.mode,
    modelId: row.modelId,
    displayName: humanDisplayName(row.modelId, row.displayName),
    providerId: row.providerId,
    costPoints: asInt(row.costPoints),
    videoConfigPoints: (row.videoConfigPoints as VideoConfigPoints) ?? null,
    isSpicy: Boolean(row.isSpicy),
  }));

  const rawModelId = typeof modelIdRaw === "string" ? modelIdRaw.trim() : "";
  const isExplicitSpicy =
    typeof isSpicyRaw === "boolean"
      ? isSpicyRaw
      : Boolean(rawModelId && (rawModelId.includes("spicy") || rawModelId.includes("uncensored")));

  if (rawModelId === "image-upscale" || rawModelId === "seedvr-upscale" || rawModelId.includes("upscale")) {
    const upscaleRow = catalogRows.find((r) => r.modelId.includes("upscale"));
    if (upscaleRow) {
      return { ...upscaleRow, mode };
    }
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Fitur atau model upscale sedang dinonaktifkan");
  }

  if (rawModelId === "image-inpaint" || rawModelId === "image-edit" || rawModelId.includes("inpaint") || mode === "inpaint") {
    const defaults = await getActiveDefaultModels();
    const inpaintTargetId = defaults.inpaintModelId || "fal-ai/flux-lora/inpainting";

    // 1. Cek model inpaint yang dikonfigurasi admin
    const preferred = catalogRows.find((r) => r.modelId === inpaintTargetId);
    if (preferred) {
      return { ...preferred, mode: "inpaint" as JobMode };
    }

    // 2. Cek baris model inpaint yang aktif
    const inpaintRow = catalogRows.find((r) => r.mode === "inpaint" || r.modelId.includes("inpaint"));
    if (inpaintRow) {
      return { ...inpaintRow, mode: "inpaint" as JobMode };
    }

    const directInpaint = await prisma.modelCatalog.findFirst({
      where: {
        OR: [
          { modelId: inpaintTargetId, enabled: true },
          { mode: "inpaint", enabled: true },
          { modelId: { contains: "inpaint" }, enabled: true },
        ],
      },
    });
    if (directInpaint) {
      return {
        mode: "inpaint" as JobMode,
        modelId: directInpaint.modelId,
        displayName: humanDisplayName(directInpaint.modelId, directInpaint.displayName),
        providerId: directInpaint.providerId,
        costPoints: asInt(directInpaint.costPoints),
        videoConfigPoints: (directInpaint.videoConfigPoints as VideoConfigPoints) ?? null,
        isSpicy: Boolean(directInpaint.isSpicy),
      };
    }
    return {
      mode: "inpaint" as JobMode,
      modelId: "fal-ai/flux-lora/inpainting",
      displayName: "Flux LoRA Inpainting / Image Edit",
      providerId: "falai",
      costPoints: 10,
      videoConfigPoints: null,
      isSpicy: false,
    };
  }

  const isAbstract =
    !rawModelId ||
    rawModelId === "t2i-standard" ||
    rawModelId === "t2i-spicy" ||
    rawModelId === "i2i-standard" ||
    rawModelId === "i2i-spicy" ||
    rawModelId === "video-standard" ||
    rawModelId === "video-spicy" ||
    rawModelId === "t2v-standard" ||
    rawModelId === "t2v-spicy" ||
    rawModelId === "i2v-standard" ||
    rawModelId === "i2v-spicy" ||
    rawModelId === "image-standard" ||
    rawModelId === "image-spicy" ||
    rawModelId === "image-edit-standard" ||
    rawModelId === "image-edit-spicy";

  if (isAbstract) {
    const defaults = await getActiveDefaultModels();
    let targetModelId = "";
    if (mode === "t2i") {
      targetModelId = isExplicitSpicy ? defaults.spicyT2iModelId : defaults.normalT2iModelId;
    } else if (mode === "i2i") {
      targetModelId = isExplicitSpicy ? defaults.spicyI2iModelId : defaults.normalI2iModelId;
    } else {
      targetModelId = isExplicitSpicy ? defaults.spicyVideoModelId : defaults.normalVideoModelId;
    }

    const preferred = catalogRows.find((r) => r.modelId === targetModelId);
    if (preferred) {
      return { ...preferred, mode };
    }

    const matchingSpicy = catalogRows.filter((r) => r.isSpicy === isExplicitSpicy && !r.modelId.includes("upscale"));
    if (matchingSpicy.length > 0) {
      return { ...matchingSpicy[0]!, mode };
    }
  }

  return pickEnabledModel(catalogRows, modeRaw, modelIdRaw);
}
