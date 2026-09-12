import { prisma } from "@ai-gen-free/db";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import { adjustWallet, computeBalance } from "@ai-gen-free/wallet";
import {
  GENERATE_COOLDOWN_KEY,
  asCooldownSeconds,
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
  actorId: string;
  ip: string;
}) {
  const model = await prisma.modelCatalog.findUnique({ where: { id: opts.id } });
  if (!model) throw new AppError(ErrorCodes.NOT_FOUND, "Model catalog tidak ditemukan", 404);

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.modelCatalog.update({
      where: { id: opts.id },
      data: {
        ...(typeof opts.costPoints === "number" ? { costPoints: opts.costPoints } : {}),
        ...(typeof opts.displayName === "string" ? { displayName: opts.displayName.trim() } : {}),
        ...(typeof opts.enabled === "boolean" ? { enabled: opts.enabled } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: opts.actorId,
        action: "model_catalog.updated",
        target: model.id,
        ip: opts.ip,
        meta: {
          modelId: model.modelId,
          from: { costPoints: Number(model.costPoints), enabled: model.enabled, displayName: model.displayName },
          to: { costPoints: Number(res.costPoints), enabled: res.enabled, displayName: res.displayName },
        },
      },
    });
    return res;
  });

  logEvent("admin.model_catalog.updated", { actorId: opts.actorId, id: model.id, modelId: model.modelId });

  return {
    id: updated.id,
    mode: updated.mode,
    modelId: updated.modelId,
    displayName: updated.displayName,
    providerId: updated.providerId,
    costPoints: Number(updated.costPoints),
    enabled: updated.enabled,
    createdAt: updated.createdAt.toISOString(),
  };
}
