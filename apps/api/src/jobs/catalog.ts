import { prisma } from "@ai-gen-free/db";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import type { JobMode } from "@prisma/client";

const DISPLAY_FALLBACK: Record<string, string> = {
  "black-forest-labs/flux-1.1-pro-t2i": "Flux 1.1 Pro",
  "openai/gpt-image-2-t2i": "GPT Image 2",
  "bytedance/seedream-5.0-pro-t2i-spicy": "Seedream 5.0 Pro Spicy",
  "dummy-t2i": "Dummy",
};

function asInt(value: { toString(): string } | number): number {
  return typeof value === "number" ? value : Number(value);
}

export type CatalogRow = {
  mode: JobMode;
  modelId: string;
  displayName: string;
  providerId: string;
  costPoints: number;
};

export function humanDisplayName(modelId: string, displayName?: string | null): string {
  const named = displayName?.trim();
  if (named) return named;
  return DISPLAY_FALLBACK[modelId] ?? modelId;
}

export function pickEnabledModel(rows: CatalogRow[], modeRaw: unknown, modelIdRaw: unknown): CatalogRow {
  if (modeRaw !== "t2i") {
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
  }));
}

export async function resolveModel(modeRaw: unknown, modelIdRaw: unknown) {
  if (modeRaw !== "t2i") {
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
    })),
    modeRaw,
    modelIdRaw,
  );
}
