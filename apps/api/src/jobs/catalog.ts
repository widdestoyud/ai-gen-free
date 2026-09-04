import { prisma } from "@ai-gen-free/db";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import type { JobMode } from "@prisma/client";

function asInt(value: { toString(): string } | number): number {
  return typeof value === "number" ? value : Number(value);
}

export async function listEnabledModels() {
  const rows = await prisma.modelCatalog.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    mode: row.mode,
    modelId: row.modelId,
    providerId: row.providerId,
    costPoints: asInt(row.costPoints),
  }));
}

export async function resolveModel(modeRaw: unknown) {
  if (modeRaw !== "t2i") {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Mode ini belum tersedia");
  }
  const mode = modeRaw as JobMode;
  const row = await prisma.modelCatalog.findFirst({
    where: { mode, enabled: true },
    orderBy: { createdAt: "asc" },
  });
  if (!row) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Tidak ada model aktif untuk mode ini");
  }
  return {
    mode: row.mode,
    modelId: row.modelId,
    providerId: row.providerId,
    costPoints: asInt(row.costPoints),
  };
}
