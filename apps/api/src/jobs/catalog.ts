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
  "alibaba/wan-2.7-i2v-uncensored": "Wan 2.7 I2V Uncensored",
  "dummy-t2i": "Dummy",
};

const VALID_MODES = new Set<string>(["t2i", "i2i", "t2v", "i2v"]);

function asInt(value: { toString(): string } | number): number {
  return typeof value === "number" ? value : Number(value);
}

export type CatalogRow = {
  mode: JobMode;
  modelId: string;
  displayName: string;
  providerId: string;
  costPoints: number;
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
  const forMode = rows.filter((row) => row.mode === mode);
  if (typeof modelIdRaw === "string" && modelIdRaw.trim()) {
    const found = forMode.find((row) => row.modelId === modelIdRaw.trim());
    if (!found) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "Model tidak tersedia");
    }
    return found;
  }
  if (forMode.length === 1) return forMode[0]!;
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
    isSpicy: Boolean(row.isSpicy),
  }));
}

export async function resolveModel(modeRaw: unknown, modelIdRaw: unknown) {
  if (typeof modeRaw !== "string" || !VALID_MODES.has(modeRaw)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Mode ini belum tersedia");
  }
  const mode = modeRaw as JobMode;
  const rows = await prisma.modelCatalog.findMany({
    where: { mode, enabled: true },
    orderBy: { createdAt: "asc" },
  });
  return pickEnabledModel(
    rows.map((row) => ({
      mode: row.mode,
      modelId: row.modelId,
      displayName: humanDisplayName(row.modelId, row.displayName),
      providerId: row.providerId,
      costPoints: asInt(row.costPoints),
      isSpicy: Boolean(row.isSpicy),
    })),
    modeRaw,
    modelIdRaw,
  );
}
