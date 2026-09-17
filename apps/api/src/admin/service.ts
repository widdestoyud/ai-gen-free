import { prisma } from "@ai-gen-free/db";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import { adjustWallet, computeBalance } from "@ai-gen-free/wallet";
import {
  DEFAULT_FALLBACK_MODELS,
  DEFAULT_GENERATION_MODELS_KEY,
  GENERATE_COOLDOWN_KEY,
  asCooldownSeconds,
  type DefaultGenerationModelsConfig,
} from "./parse.js";

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function logEvent(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...payload }));
}

export async function getGenerateCooldownSetting() {
  const row = await prisma.appSetting.findUnique({ where: { key: GENERATE_COOLDOWN_KEY } });
  return { key: GENERATE_COOLDOWN_KEY, value: asCooldownSeconds(row?.value) };
}

export async function putGenerateCooldownSetting(opts: {
  value: number;
  actorId: string;
  ip: string;
}) {
  const current = await prisma.appSetting.findUnique({ where: { key: GENERATE_COOLDOWN_KEY } });
  const from = asCooldownSeconds(current?.value);
  await prisma.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: GENERATE_COOLDOWN_KEY },
      update: { value: opts.value },
      create: { key: GENERATE_COOLDOWN_KEY, value: opts.value },
    });
    await tx.auditLog.create({
      data: {
        actorId: opts.actorId,
        action: "settings.generate_cooldown_seconds.updated",
        target: GENERATE_COOLDOWN_KEY,
        ip: opts.ip,
        meta: { from, to: opts.value },
      },
    });
  });
  logEvent("admin.settings.updated", {
    actorId: opts.actorId,
    key: GENERATE_COOLDOWN_KEY,
    from,
    to: opts.value,
  });
  return { key: GENERATE_COOLDOWN_KEY, value: opts.value };
}

export async function getDefaultGenerationModelsSetting(): Promise<{
  key: string;
  value: DefaultGenerationModelsConfig;
}> {
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
  };
  return { key: DEFAULT_GENERATION_MODELS_KEY, value: config };
}

export async function putDefaultGenerationModelsSetting(opts: {
  config: Partial<DefaultGenerationModelsConfig>;
  actorId: string;
  ip: string;
}) {
  const enabledModels = await prisma.modelCatalog.findMany({
    where: { enabled: true },
  });

  const { value: current } = await getDefaultGenerationModelsSetting();

  const normalT2iModelId = opts.config.normalT2iModelId?.trim() ?? current.normalT2iModelId;
  const normalI2iModelId = opts.config.normalI2iModelId?.trim() ?? current.normalI2iModelId;
  const spicyT2iModelId = opts.config.spicyT2iModelId?.trim() ?? current.spicyT2iModelId;
  const spicyI2iModelId = opts.config.spicyI2iModelId?.trim() ?? current.spicyI2iModelId;
  const normalVideoModelId = opts.config.normalVideoModelId?.trim() ?? current.normalVideoModelId;
  const spicyVideoModelId = opts.config.spicyVideoModelId?.trim() ?? current.spicyVideoModelId;

  // 1. Validasi Normal T2I Model (Wajib Gambar T2I, bukan Video, bukan Spicy)
  const normT2i = enabledModels.find((m) => m.modelId === normalT2iModelId);
  if (!normT2i || normT2i.mode !== "t2i" || normT2i.isSpicy) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      `Model "${normalT2iModelId}" tidak valid untuk Normal T2I. Model harus aktif, berjenis gambar t2i, dan non-spicy.`,
    );
  }

  // 2. Validasi Normal I2I Model (Wajib Gambar I2I, bukan Video, bukan Spicy)
  const normI2i = enabledModels.find((m) => m.modelId === normalI2iModelId);
  if (!normI2i || normI2i.mode !== "i2i" || normI2i.isSpicy) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      `Model "${normalI2iModelId}" tidak valid untuk Normal I2I. Model harus aktif, berjenis gambar i2i, dan non-spicy.`,
    );
  }

  // 3. Validasi Spicy T2I Model (Wajib Gambar T2I Spicy, bukan Video)
  const spT2i = enabledModels.find((m) => m.modelId === spicyT2iModelId);
  if (!spT2i || spT2i.mode !== "t2i" || !spT2i.isSpicy) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      `Model "${spicyT2iModelId}" tidak valid untuk Spicy T2I. Model harus aktif, berjenis gambar t2i, dan mode spicy aktif.`,
    );
  }

  // 4. Validasi Spicy I2I Model (Wajib Gambar I2I Spicy, bukan Video)
  const spI2i = enabledModels.find((m) => m.modelId === spicyI2iModelId);
  if (!spI2i || spI2i.mode !== "i2i" || !spI2i.isSpicy) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      `Model "${spicyI2iModelId}" tidak valid untuk Spicy I2I. Model harus aktif, berjenis gambar i2i, dan mode spicy aktif.`,
    );
  }

  // 5. Validasi Normal Video Model (Wajib Video i2v/t2v, BUKAN model gambar, bukan Spicy)
  const normVid = enabledModels.find((m) => m.modelId === normalVideoModelId);
  if (!normVid || (normVid.mode !== "i2v" && normVid.mode !== "t2v") || normVid.isSpicy) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      `Model "${normalVideoModelId}" tidak valid untuk Video Normal. Model harus aktif, berjenis video (i2v/t2v), non-spicy, dan TIDAK BOLEH berupa model gambar.`,
    );
  }

  // 6. Validasi Spicy Video Model (Wajib Video i2v/t2v Spicy, BUKAN model gambar)
  const spVid = enabledModels.find((m) => m.modelId === spicyVideoModelId);
  if (!spVid || (spVid.mode !== "i2v" && spVid.mode !== "t2v") || !spVid.isSpicy) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      `Model "${spicyVideoModelId}" tidak valid untuk Video Spicy. Model harus aktif, berjenis video (i2v/t2v), mode spicy aktif, dan TIDAK BOLEH berupa model gambar.`,
    );
  }

  const updatedConfig: DefaultGenerationModelsConfig = {
    normalT2iModelId,
    normalI2iModelId,
    spicyT2iModelId,
    spicyI2iModelId,
    normalVideoModelId,
    spicyVideoModelId,
  };

  await prisma.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: DEFAULT_GENERATION_MODELS_KEY },
      update: { value: updatedConfig },
      create: { key: DEFAULT_GENERATION_MODELS_KEY, value: updatedConfig },
    });
    await tx.auditLog.create({
      data: {
        actorId: opts.actorId,
        action: "settings.default_generation_models.updated",
        target: DEFAULT_GENERATION_MODELS_KEY,
        ip: opts.ip,
        meta: { from: current, to: updatedConfig },
      },
    });
  });

  logEvent("admin.settings.default_generation_models.updated", {
    actorId: opts.actorId,
    key: DEFAULT_GENERATION_MODELS_KEY,
    from: current,
    to: updatedConfig,
  });

  return { key: DEFAULT_GENERATION_MODELS_KEY, value: updatedConfig };
}

async function serializeAdminUser(
  user: {
    id: string;
    email: string;
    role: string;
    nextGenerateAt: Date | null;
    createdAt: Date;
    emailVerifiedAt?: Date | null;
  },
  extra: { emailVerifiedAt?: boolean },
) {
  const bal = await computeBalance(user.id);
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    nextGenerateAt: iso(user.nextGenerateAt),
    available: bal.available,
    held: bal.held,
    createdAt: user.createdAt.toISOString(),
    ...(extra.emailVerifiedAt ? { emailVerifiedAt: iso(user.emailVerifiedAt ?? null) } : {}),
  };
}

export async function listAdminUsers(opts: { q?: string; limit: number; offset: number }) {
  const rows = await prisma.user.findMany({
    where: opts.q ? { email: { contains: opts.q, mode: "insensitive" } } : {},
    orderBy: { createdAt: "desc" },
    take: opts.limit,
    skip: opts.offset,
    select: {
      id: true,
      email: true,
      role: true,
      nextGenerateAt: true,
      createdAt: true,
    },
  });
  return {
    users: await Promise.all(rows.map((row) => serializeAdminUser(row, {}))),
  };
}

export async function getAdminUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      nextGenerateAt: true,
      createdAt: true,
      emailVerifiedAt: true,
    },
  });
  if (!user) throw new AppError(ErrorCodes.NOT_FOUND, "User tidak ditemukan", 404);
  return serializeAdminUser(user, { emailVerifiedAt: true });
}

export async function resetUserCooldown(opts: { userId: string; actorId: string; ip: string }) {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { id: true, nextGenerateAt: true },
  });
  if (!user) throw new AppError(ErrorCodes.NOT_FOUND, "User tidak ditemukan", 404);
  const previousNextGenerateAt = iso(user.nextGenerateAt);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { nextGenerateAt: null },
    }),
    prisma.auditLog.create({
      data: {
        actorId: opts.actorId,
        action: "user.cooldown.reset",
        target: user.id,
        ip: opts.ip,
        meta: { previousNextGenerateAt },
      },
    }),
  ]);
  logEvent("admin.user.cooldown_reset", { actorId: opts.actorId, userId: user.id });
  return { ok: true as const, userId: user.id, nextGenerateAt: null };
}

export async function adjustUserWallet(opts: {
  userId: string;
  amount: number;
  reason: string;
  clientKey: string;
  actorId: string;
  ip: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: opts.userId }, select: { id: true } });
  if (!user) throw new AppError(ErrorCodes.NOT_FOUND, "User tidak ditemukan", 404);
  const result = await adjustWallet({
    userId: user.id,
    amount: opts.amount,
    reason: opts.reason,
    clientKey: opts.clientKey,
    createdByUserId: opts.actorId,
  });
  if (!result.idempotent) {
    await prisma.auditLog.create({
      data: {
        actorId: opts.actorId,
        action: "wallet.adjusted",
        target: user.id,
        ip: opts.ip,
        meta: { amount: opts.amount, reason: opts.reason, ledgerId: result.entry.id },
      },
    });
    logEvent("admin.wallet.adjusted", {
      actorId: opts.actorId,
      userId: user.id,
      amount: opts.amount,
    });
  }
  return {
    ok: true as const,
    userId: user.id,
    available: result.available,
    held: result.held,
    entry: result.entry,
  };
}

export async function listAuditLogs(opts: { limit: number; offset: number; action?: string }) {
  const rows = await prisma.auditLog.findMany({
    where: opts.action ? { action: opts.action } : {},
    orderBy: { createdAt: "desc" },
    take: opts.limit,
    skip: opts.offset,
    include: { actor: { select: { email: true } } },
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      actorEmail: row.actor?.email ?? null,
      action: row.action,
      target: row.target,
      ip: row.ip,
      meta: row.meta,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

function serializeAdminModel(row: {
  id: string;
  mode: string;
  modelId: string;
  displayName: string;
  providerId: string;
  costPoints: { toString(): string } | number;
  enabled: boolean;
  isSpicy: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    mode: row.mode,
    modelId: row.modelId,
    displayName: row.displayName,
    providerId: row.providerId,
    costPoints: Number(row.costPoints),
    enabled: row.enabled,
    isSpicy: row.isSpicy,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAdminModels() {
  const rows = await prisma.modelCatalog.findMany({
    orderBy: { createdAt: "asc" },
  });
  return { models: rows.map(serializeAdminModel) };
}

export async function listAdminModelsByProvider(provider: string) {
  const rows = await prisma.modelCatalog.findMany({
    where: { providerId: { equals: provider, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
  });
  return {
    provider,
    models: rows.map(serializeAdminModel),
  };
}

export async function updateAdminModel(opts: {
  id: string;
  costPoints?: number;
  displayName?: string;
  enabled?: boolean;
  isSpicy?: boolean;
  actorId: string;
  ip: string;
}) {
  const cleanId = opts.id.trim();
  let model = await prisma.modelCatalog.findUnique({ where: { id: cleanId } });
  if (!model) {
    const decoded = decodeURIComponent(cleanId);
    model = await prisma.modelCatalog.findFirst({
      where: {
        OR: [
          { modelId: cleanId },
          { modelId: decoded },
          { modelId: { endsWith: cleanId } },
          { modelId: { endsWith: decoded } },
        ],
      },
    });
  }
  if (!model) throw new AppError(ErrorCodes.NOT_FOUND, "Model catalog tidak ditemukan", 404);

  const modelRecordId = model.id;

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.modelCatalog.update({
      where: { id: modelRecordId },
      data: {
        ...(typeof opts.costPoints === "number" ? { costPoints: opts.costPoints } : {}),
        ...(typeof opts.displayName === "string" ? { displayName: opts.displayName.trim() } : {}),
        ...(typeof opts.enabled === "boolean" ? { enabled: opts.enabled } : {}),
        ...(typeof opts.isSpicy === "boolean" ? { isSpicy: opts.isSpicy } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: opts.actorId,
        action: "model_catalog.updated",
        target: modelRecordId,
        ip: opts.ip,
        meta: {
          modelId: model.modelId,
          from: { costPoints: Number(model.costPoints), enabled: model.enabled, displayName: model.displayName, isSpicy: model.isSpicy },
          to: { costPoints: Number(res.costPoints), enabled: res.enabled, displayName: res.displayName, isSpicy: res.isSpicy },
        },
      },
    });
    return res;
  });

  logEvent("admin.model_catalog.updated", { actorId: opts.actorId, id: modelRecordId, modelId: model.modelId });

  return {
    id: updated.id,
    mode: updated.mode,
    modelId: updated.modelId,
    displayName: updated.displayName,
    providerId: updated.providerId,
    costPoints: Number(updated.costPoints),
    enabled: updated.enabled,
    isSpicy: updated.isSpicy,
    createdAt: updated.createdAt.toISOString(),
  };
}
