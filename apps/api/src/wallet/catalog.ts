import { Prisma } from "@prisma/client";
import { prisma } from "@ai-gen-free/db";
import { AuthError } from "../auth/service.js";
import { ErrorCodes } from "@ai-gen-free/core";

export type TopupPackage = {
  id: string;
  name: string;
  label: string;
  description?: string | null;
  amountIdr: number;
  originalAmountIdr?: number | null;
  points: number;
  active: boolean;
  sortOrder: number;
  badgeText?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export interface CreatePackageInput {
  name: string;
  description?: string;
  amountIdr: number;
  originalAmountIdr?: number;
  points: number;
  active?: boolean;
  sortOrder?: number;
  badgeText?: string;
}

export interface UpdatePackageInput {
  name?: string;
  description?: string | null;
  amountIdr?: number;
  originalAmountIdr?: number | null;
  points?: number;
  active?: boolean;
  sortOrder?: number;
  badgeText?: string | null;
}

export const DEFAULT_PACKAGES = [
  {
    name: "Paket Hemat 200 Poin",
    amountIdr: 20_000,
    originalAmountIdr: 30_000,
    points: 200,
    description: "Cocok untuk eksplorasi dan percobaan prompt awal",
    badgeText: "HEMAT 33%",
    sortOrder: 1,
    active: true,
  },
  {
    name: "Paket Populer 500 Poin",
    amountIdr: 50_000,
    originalAmountIdr: 75_000,
    points: 500,
    description: "Pilihan favorit untuk kebutuhan generate konten harian",
    badgeText: "POPULER",
    sortOrder: 2,
    active: true,
  },
  {
    name: "Paket Sultan 1.200 Poin",
    amountIdr: 100_000,
    originalAmountIdr: 180_000,
    points: 1_200,
    description: "Maksimal hemat untuk kreator profesional dan batch generation",
    badgeText: "BEST VALUE",
    sortOrder: 3,
    active: true,
  },
];

export const TOPUP_PACKAGES: TopupPackage[] = DEFAULT_PACKAGES.map((p) => ({
  id: `p${p.amountIdr / 1000}`,
  name: p.name,
  label: `${p.name} · ${p.points.toLocaleString("id-ID")} poin`,
  amountIdr: p.amountIdr,
  originalAmountIdr: p.originalAmountIdr,
  points: p.points,
  description: p.description,
  badgeText: p.badgeText,
  sortOrder: p.sortOrder,
  active: p.active,
}));

function asInt(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

function serializePackage(row: {
  id: string;
  name: string;
  description: string | null;
  amountIdr: Prisma.Decimal;
  originalAmountIdr: Prisma.Decimal | null;
  points: Prisma.Decimal;
  active: boolean;
  sortOrder: number;
  badgeText: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TopupPackage {
  const amountIdr = asInt(row.amountIdr);
  const points = asInt(row.points);
  return {
    id: row.id,
    name: row.name,
    label: `${row.name} · ${points.toLocaleString("id-ID")} poin`,
    description: row.description,
    amountIdr,
    originalAmountIdr: row.originalAmountIdr ? asInt(row.originalAmountIdr) : undefined,
    points,
    active: row.active,
    sortOrder: row.sortOrder,
    badgeText: row.badgeText,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Seed initial packages if database table is completely empty
 */
async function seedDefaultPackagesIfEmpty(): Promise<void> {
  try {
    const count = await prisma.topupPackage.count();
    if (count === 0) {
      await prisma.$transaction(
        DEFAULT_PACKAGES.map((p) =>
          prisma.topupPackage.create({
            data: {
              name: p.name,
              description: p.description,
              amountIdr: p.amountIdr,
              originalAmountIdr: p.originalAmountIdr,
              points: p.points,
              active: p.active,
              sortOrder: p.sortOrder,
              badgeText: p.badgeText,
            },
          }),
        ),
      );
    }
  } catch {
    // Ignore seeding error if concurrent
  }
}

/**
 * List active packages for customers (/customer/packages or /catalog/topup)
 */
export async function listPackages(): Promise<TopupPackage[]> {
  try {
    await seedDefaultPackagesIfEmpty();
    const rows = await prisma.topupPackage.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    if (rows.length > 0) {
      return rows.map(serializePackage);
    }
  } catch {
    // Fallback to static in case DB is unreachable
  }
  return TOPUP_PACKAGES;
}

/**
 * Synchronous static fallback for unit tests
 */
export function listStaticPackages(): TopupPackage[] {
  return TOPUP_PACKAGES;
}

/**
 * Find package by ID (checks database first, then static fallback)
 */
export async function findPackage(id: unknown): Promise<TopupPackage | undefined> {
  if (typeof id !== "string" || !id.trim()) return undefined;
  const cleanId = id.trim();

  try {
    const row = await prisma.topupPackage.findUnique({
      where: { id: cleanId },
    });
    if (row) {
      return serializePackage(row);
    }
  } catch {
    // Fallback
  }

  return TOPUP_PACKAGES.find((p) => p.id === cleanId);
}

/**
 * List all packages for Admin (including inactive)
 */
export async function listAdminPackages(): Promise<TopupPackage[]> {
  await seedDefaultPackagesIfEmpty();
  const rows = await prisma.topupPackage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(serializePackage);
}

/**
 * Get package detail for Admin
 */
export async function getAdminPackage(id: string): Promise<TopupPackage> {
  const row = await prisma.topupPackage.findUnique({ where: { id } });
  if (!row) {
    throw new AuthError(ErrorCodes.NOT_FOUND, "Paket tidak ditemukan", 404);
  }
  return serializePackage(row);
}

/**
 * Create package by Admin
 */
export async function createAdminPackage(
  adminUserId: string,
  input: CreatePackageInput,
): Promise<TopupPackage> {
  if (!input.name || typeof input.name !== "string" || !input.name.trim()) {
    throw new AuthError(ErrorCodes.VALIDATION_ERROR, "Nama paket wajib diisi");
  }
  const amountIdr = Number(input.amountIdr);
  if (Number.isNaN(amountIdr) || amountIdr <= 0) {
    throw new AuthError(ErrorCodes.VALIDATION_ERROR, "Harga paket harus lebih dari 0");
  }
  const points = Number(input.points);
  if (Number.isNaN(points) || points <= 0) {
    throw new AuthError(ErrorCodes.VALIDATION_ERROR, "Poin paket harus lebih dari 0");
  }

  const originalAmountIdr =
    input.originalAmountIdr !== undefined && input.originalAmountIdr !== null
      ? Number(input.originalAmountIdr)
      : null;

  const row = await prisma.topupPackage.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      amountIdr,
      originalAmountIdr: originalAmountIdr && originalAmountIdr > 0 ? originalAmountIdr : null,
      points,
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 0,
      badgeText: input.badgeText?.trim() || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminUserId,
      action: "package.created",
      target: row.id,
      meta: {
        name: row.name,
        amountIdr,
        points,
      },
    },
  });

  return serializePackage(row);
}

/**
 * Update package by Admin
 */
export async function updateAdminPackage(
  adminUserId: string,
  id: string,
  input: UpdatePackageInput,
): Promise<TopupPackage> {
  const existing = await prisma.topupPackage.findUnique({ where: { id } });
  if (!existing) {
    throw new AuthError(ErrorCodes.NOT_FOUND, "Paket tidak ditemukan", 404);
  }

  const data: Prisma.TopupPackageUpdateInput = {};

  if (input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim()) {
      throw new AuthError(ErrorCodes.VALIDATION_ERROR, "Nama paket tidak boleh kosong");
    }
    data.name = input.name.trim();
  }

  if (input.description !== undefined) {
    data.description = input.description ? input.description.trim() : null;
  }

  if (input.amountIdr !== undefined) {
    const amount = Number(input.amountIdr);
    if (Number.isNaN(amount) || amount <= 0) {
      throw new AuthError(ErrorCodes.VALIDATION_ERROR, "Harga paket harus lebih dari 0");
    }
    data.amountIdr = amount;
  }

  if (input.originalAmountIdr !== undefined) {
    if (input.originalAmountIdr === null || input.originalAmountIdr === 0) {
      data.originalAmountIdr = null;
    } else {
      const orig = Number(input.originalAmountIdr);
      data.originalAmountIdr = !Number.isNaN(orig) && orig > 0 ? orig : null;
    }
  }

  if (input.points !== undefined) {
    const pts = Number(input.points);
    if (Number.isNaN(pts) || pts <= 0) {
      throw new AuthError(ErrorCodes.VALIDATION_ERROR, "Poin paket harus lebih dari 0");
    }
    data.points = pts;
  }

  if (input.active !== undefined) {
    data.active = Boolean(input.active);
  }

  if (input.sortOrder !== undefined) {
    data.sortOrder = Number(input.sortOrder) || 0;
  }

  if (input.badgeText !== undefined) {
    data.badgeText = input.badgeText ? input.badgeText.trim() : null;
  }

  const updated = await prisma.topupPackage.update({
    where: { id },
    data,
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminUserId,
      action: "package.updated",
      target: id,
      meta: {
        updates: input,
      },
    },
  });

  return serializePackage(updated);
}

/**
 * Delete package by Admin
 */
export async function deleteAdminPackage(
  adminUserId: string,
  id: string,
): Promise<{ success: boolean; id: string }> {
  const existing = await prisma.topupPackage.findUnique({ where: { id } });
  if (!existing) {
    throw new AuthError(ErrorCodes.NOT_FOUND, "Paket tidak ditemukan", 404);
  }

  await prisma.topupPackage.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorId: adminUserId,
      action: "package.deleted",
      target: id,
      meta: {
        name: existing.name,
      },
    },
  });

  return { success: true, id };
}

export function qrisInstructions(uniqueCode: string, amountIdr: number): string {
  const base =
    process.env.QRIS_INSTRUCTIONS ??
    "Bayar QRIS statis sesuai nominal invoice, lalu unggah bukti di dashboard. Screenshot WhatsApp/Telegram tidak mengkredit poin.";
  return `${base} Nominal Rp${amountIdr.toLocaleString("id-ID")}. Kode: ${uniqueCode}.`;
}
