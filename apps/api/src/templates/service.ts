import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  AppError,
  AuthResponses,
  ErrorCodes,
  UploadConfig,
  isSafePublicUrl,
  type ObjectStorage,
} from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import { AuthError } from "../auth/service.js";
import { compressUploadImage, isAllowedMimeType } from "../uploads/service.js";
import {
  TEMPLATE_KEY_RE,
  TEMPLATE_MODEL_IDS,
  type AdminListQuery,
  type CustomerListQuery,
  type TemplateInput,
} from "./parse.js";

const VALID_MODEL_ID_SET = new Set<string>(TEMPLATE_MODEL_IDS);
const SIGNED_URL_TTL_SECONDS = 3600;
const IMPORT_FETCH_TIMEOUT_MS = 15_000;
const IMPORT_MAX_REDIRECTS = 5;

export type CustomerTemplateImageView = {
  id: string;
  url: string;
  alias: string | null;
  width: number;
  height: number;
};

export type CustomerTemplateView = {
  id: string;
  title: string;
  prompt: string;
  category: string | null;
  modelId: string | null;
  aspectRatio: string;
  isSpicy: boolean;
  coverUrl: string;
  coverWidth?: number;
  coverHeight?: number;
  images: CustomerTemplateImageView[];
};

export type AdminTemplateImageView = CustomerTemplateImageView & {
  key: string;
};

export type AdminTemplateView = Omit<CustomerTemplateView, "images"> & {
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  cover: {
    key: string;
    url: string;
    width: number;
    height: number;
  };
  images: AdminTemplateImageView[];
};

export type TemplateAssetUploadResult = {
  key: string;
  url: string;
  width: number;
  height: number;
};

export type TemplateImageRowInput = {
  id: string;
  storageKey: string;
  alias: string | null;
  position?: number;
  width: number;
  height: number;
};

export type CustomerTemplateRowInput = {
  id: string;
  title: string;
  prompt: string;
  category: string | null;
  modelId: string | null;
  aspectRatio: string;
  isSpicy: boolean;
  coverStorageKey: string;
  images: TemplateImageRowInput[];
};

export type AdminTemplateRowInput = CustomerTemplateRowInput & {
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
  coverWidth: number;
  coverHeight: number;
  createdAt: Date;
  updatedAt: Date;
};

/** Mengembalikan storage key pada `before` yang sudah tidak direferensikan di `after`. */
export function diffRemovedKeys(before: string[], after: string[]): string[] {
  const keep = new Set(after);
  const removed: string[] = [];
  const seen = new Set<string>();
  for (const key of before) {
    if (!keep.has(key) && !seen.has(key)) {
      seen.add(key);
      removed.push(key);
    }
  }
  return removed;
}

/** Menegakkan izin Spicy Mode server-side sebelum query daftar atau kategori template. */
export function resolveSpicyScope(requested: boolean, userSpicyEnabled: boolean): boolean {
  if (requested && !userSpicyEnabled) {
    throw new AppError(
      ErrorCodes.SPICY_MODE_REQUIRED,
      AuthResponses.errors.SPICY_MODE_REQUIRED.message,
      403,
    );
  }
  return requested;
}

/** Mengonversi hasil query lookahead (`take: limit + 1`) menjadi halaman + flag `hasMore`. */
export function toPage<T>(rows: T[], limit: number): { items: T[]; hasMore: boolean } {
  const hasMore = rows.length > limit;
  return {
    items: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
  };
}

/** Memetakan baris template menjadi DTO pelanggan tanpa membocorkan storageKey atau model upstream. */
export async function toCustomerView(
  row: CustomerTemplateRowInput,
  urlOf: (key: string) => Promise<string>,
): Promise<CustomerTemplateView> {
  const sortedImages = [...row.images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const [coverUrl, imageUrls] = await Promise.all([
    urlOf(row.coverStorageKey),
    Promise.all(sortedImages.map((img) => urlOf(img.storageKey))),
  ]);

  const safeModelId =
    row.modelId && VALID_MODEL_ID_SET.has(row.modelId) ? row.modelId : null;

  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    category: row.category ?? null,
    modelId: safeModelId,
    aspectRatio: row.aspectRatio,
    isSpicy: row.isSpicy,
    coverUrl,
    coverWidth: typeof row.coverWidth === "number" && row.coverWidth > 0 ? row.coverWidth : undefined,
    coverHeight: typeof row.coverHeight === "number" && row.coverHeight > 0 ? row.coverHeight : undefined,
    images: sortedImages.map((img, idx) => ({
      id: img.id,
      url: imageUrls[idx] ?? "",
      alias: img.alias ?? null,
      width: img.width,
      height: img.height,
    })),
  };
}

/** Memetakan baris template menjadi DTO admin lengkap dengan metadata dan storage key. */
export async function toAdminView(
  row: AdminTemplateRowInput,
  urlOf: (key: string) => Promise<string>,
): Promise<AdminTemplateView> {
  const sortedImages = [...row.images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const customerView = await toCustomerView({ ...row, images: sortedImages }, urlOf);

  return {
    ...customerView,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    usageCount: row.usageCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    cover: {
      key: row.coverStorageKey,
      url: customerView.coverUrl,
      width: row.coverWidth,
      height: row.coverHeight,
    },
    images: customerView.images.map((img, idx) => ({
      ...img,
      key: sortedImages[idx]?.storageKey ?? "",
    })),
  };
}

function generateTemplateCuid(): string {
  const timePart = Date.now().toString(36).padStart(8, "0").slice(-8);
  const randPart = randomBytes(8).toString("hex");
  return `c${timePart}${randPart}`;
}

async function resolveStorageUrl(storage: ObjectStorage, key: string): Promise<string> {
  const publicEndpoint = process.env.STORAGE_PUBLIC_ENDPOINT?.trim();
  if (publicEndpoint) {
    return `${publicEndpoint.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
  }
  if (typeof storage.signGetUrl === "function") {
    try {
      return await storage.signGetUrl(key, SIGNED_URL_TTL_SECONDS);
    } catch {
      return "";
    }
  }
  return "";
}

async function deleteRemovedStorageKeys(
  storage: ObjectStorage,
  keys: string[],
  context: { templateId: string; actorId: string },
): Promise<void> {
  for (const key of keys) {
    if (!TEMPLATE_KEY_RE.test(key)) continue;
    try {
      await storage.delete(key);
    } catch (err) {
      console.warn(
        JSON.stringify({
          event: "template.asset_delete_failed",
          templateId: context.templateId,
          actorId: context.actorId,
          key,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}

async function fetchPublicImageBytes(sourceUrl: string, fetchImpl: typeof fetch): Promise<Uint8Array> {
  let current = sourceUrl.trim();
  if (!current || !isSafePublicUrl(current)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "URL gambar tidak valid atau dilarang", 400);
  }

  let response: Response | null = null;
  for (let hop = 0; hop <= IMPORT_MAX_REDIRECTS; hop++) {
    if (!isSafePublicUrl(current)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "URL tujuan redirect tidak diizinkan", 400);
    }
    let res: Response;
    try {
      res = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(IMPORT_FETCH_TIMEOUT_MS),
        headers: {
          accept: "image/png,image/jpeg,image/webp,image/*;q=0.8",
          "user-agent": "ai-gen-free-api/1.0",
        },
      });
    } catch {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "Gagal mengunduh gambar dari URL", 400);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, "Redirect URL gambar tidak memiliki target", 400);
      }
      try {
        current = new URL(location, current).href;
      } catch {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, "Target redirect URL tidak valid", 400);
      }
      continue;
    }

    response = res;
    break;
  }

  if (!response) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Terlalu banyak pengalihan URL gambar", 400);
  }
  if (!response.ok) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      `Gagal mengunduh gambar dari URL (HTTP ${response.status})`,
      400,
    );
  }

  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > UploadConfig.limits.maxSizeBytes) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        "Ukuran berkas dari URL melebihi batas maksimal 5 MB",
        400,
      );
    }
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Berkas gambar dari URL kosong", 400);
  }
  if (bytes.length > UploadConfig.limits.maxSizeBytes) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      "Ukuran berkas dari URL melebihi batas maksimal 5 MB",
      400,
    );
  }

  return bytes;
}

async function compressToTemplateWebp(bytes: Uint8Array) {
  try {
    return await compressUploadImage(bytes);
  } catch (err) {
    if (err instanceof AuthError) {
      throw new AppError(err.code, err.message, err.status);
    }
    throw err;
  }
}

function buildAdminOrderBy(q: AdminListQuery): Prisma.TemplateOrderByWithRelationInput[] {
  if (q.sortBy === "createdAt") {
    return [{ createdAt: q.sortOrder }];
  }
  return [{ [q.sortBy]: q.sortOrder }, { createdAt: "desc" }];
}

function buildCustomerOrderBy(sort: CustomerListQuery["sort"]): Prisma.TemplateOrderByWithRelationInput[] {
  if (sort === "trending") {
    return [{ usageCount: "desc" }, { createdAt: "desc" }];
  }
  if (sort === "newest") {
    return [{ createdAt: "desc" }];
  }
  return [{ sortOrder: "asc" }, { createdAt: "desc" }];
}

export function createTemplateService(deps: {
  storage: ObjectStorage;
  db?: typeof prisma;
  fetchImpl?: typeof fetch;
}) {
  const { storage, db = prisma, fetchImpl = fetch } = deps;
  const urlOf = (key: string) => resolveStorageUrl(storage, key);

  async function assertUserSpicyFlag(userId: string): Promise<boolean> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { spicyModeEnabled: true },
    });
    if (!user) {
      throw new AppError(
        ErrorCodes.UNAUTHENTICATED,
        AuthResponses.errors.UNAUTHENTICATED.message,
        401,
      );
    }
    return user.spicyModeEnabled;
  }

  return {
    async adminList(q: AdminListQuery): Promise<{
      items: AdminTemplateView[];
      total: number;
      page: number;
      limit: number;
    }> {
      const where: Prisma.TemplateWhereInput = {
        ...(q.isActive !== null ? { isActive: q.isActive } : {}),
        ...(q.isSpicy !== null ? { isSpicy: q.isSpicy } : {}),
        ...(q.category !== null ? { category: q.category } : {}),
        ...(q.q !== null
          ? {
              OR: [
                { title: { contains: q.q, mode: "insensitive" } },
                { prompt: { contains: q.q, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const skip = (q.page - 1) * q.limit;
      const [total, rows] = await Promise.all([
        db.template.count({ where }),
        db.template.findMany({
          where,
          orderBy: buildAdminOrderBy(q),
          skip,
          take: q.limit,
          include: { images: { orderBy: { position: "asc" } } },
        }),
      ]);

      const items = await Promise.all(rows.map((row) => toAdminView(row, urlOf)));
      return { items, total, page: q.page, limit: q.limit };
    },

    async adminGet(id: string): Promise<AdminTemplateView> {
      const row = await db.template.findUnique({
        where: { id },
        include: { images: { orderBy: { position: "asc" } } },
      });
      if (!row) {
        throw new AppError(ErrorCodes.NOT_FOUND, "Template tidak ditemukan", 404);
      }
      return toAdminView(row, urlOf);
    },

    async adminCreate(
      actorId: string,
      input: TemplateInput,
      ip?: string,
    ): Promise<AdminTemplateView> {
      const created = await db.$transaction(async (tx) => {
        const row = await tx.template.create({
          data: {
            title: input.title,
            prompt: input.prompt,
            category: input.category,
            modelId: input.modelId,
            aspectRatio: input.aspectRatio,
            isSpicy: input.isSpicy,
            isActive: input.isActive,
            sortOrder: input.sortOrder,
            coverStorageKey: input.cover.key,
            coverWidth: input.cover.width,
            coverHeight: input.cover.height,
            images: {
              create: input.images.map((img, idx) => ({
                storageKey: img.key,
                alias: img.alias,
                position: idx,
                width: img.width,
                height: img.height,
              })),
            },
          },
          include: { images: { orderBy: { position: "asc" } } },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: "template.create",
            target: row.id,
            ...(ip ? { ip } : {}),
            meta: {
              title: row.title,
              isSpicy: row.isSpicy,
              isActive: row.isActive,
              imageCount: input.images.length,
            },
          },
        });

        return row;
      });

      return toAdminView(created, urlOf);
    },

    async adminUpdate(
      actorId: string,
      id: string,
      input: TemplateInput,
      ip?: string,
    ): Promise<AdminTemplateView> {
      const { updated, removedKeys } = await db.$transaction(async (tx) => {
        const existing = await tx.template.findUnique({
          where: { id },
          include: { images: { orderBy: { position: "asc" } } },
        });
        if (!existing) {
          throw new AppError(ErrorCodes.NOT_FOUND, "Template tidak ditemukan", 404);
        }

        const beforeKeys = [
          existing.coverStorageKey,
          ...existing.images.map((img) => img.storageKey),
        ];
        const afterKeys = [input.cover.key, ...input.images.map((img) => img.key)];
        const diff = diffRemovedKeys(beforeKeys, afterKeys);

        const row = await tx.template.update({
          where: { id },
          data: {
            title: input.title,
            prompt: input.prompt,
            category: input.category,
            modelId: input.modelId,
            aspectRatio: input.aspectRatio,
            isSpicy: input.isSpicy,
            isActive: input.isActive,
            sortOrder: input.sortOrder,
            coverStorageKey: input.cover.key,
            coverWidth: input.cover.width,
            coverHeight: input.cover.height,
            images: {
              deleteMany: {},
              create: input.images.map((img, idx) => ({
                storageKey: img.key,
                alias: img.alias,
                position: idx,
                width: img.width,
                height: img.height,
              })),
            },
          },
          include: { images: { orderBy: { position: "asc" } } },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: "template.update",
            target: id,
            ...(ip ? { ip } : {}),
            meta: {
              title: row.title,
              isSpicy: row.isSpicy,
              isActive: row.isActive,
              removedKeys: diff,
            },
          },
        });

        return { updated: row, removedKeys: diff };
      });

      await deleteRemovedStorageKeys(storage, removedKeys, { templateId: id, actorId });
      return toAdminView(updated, urlOf);
    },

    async adminDelete(
      actorId: string,
      id: string,
      ip?: string,
    ): Promise<{ ok: true; id: string }> {
      const { keysToDelete } = await db.$transaction(async (tx) => {
        const existing = await tx.template.findUnique({
          where: { id },
          include: { images: { orderBy: { position: "asc" } } },
        });
        if (!existing) {
          throw new AppError(ErrorCodes.NOT_FOUND, "Template tidak ditemukan", 404);
        }

        const keys = diffRemovedKeys(
          [existing.coverStorageKey, ...existing.images.map((img) => img.storageKey)],
          [],
        );

        await tx.template.delete({ where: { id } });
        await tx.auditLog.create({
          data: {
            actorId,
            action: "template.delete",
            target: id,
            ...(ip ? { ip } : {}),
            meta: {
              title: existing.title,
              removedKeys: keys,
            },
          },
        });

        return { keysToDelete: keys };
      });

      await deleteRemovedStorageKeys(storage, keysToDelete, { templateId: id, actorId });
      return { ok: true, id };
    },

    async uploadAsset(
      input: { buffer: Uint8Array; contentType: string } | { sourceUrl: string },
    ): Promise<TemplateAssetUploadResult> {
      let rawBytes: Uint8Array;

      if ("sourceUrl" in input) {
        rawBytes = await fetchPublicImageBytes(input.sourceUrl, fetchImpl);
      } else {
        if (input.buffer.length === 0) {
          throw new AppError(ErrorCodes.VALIDATION_ERROR, "Berkas gambar kosong", 400);
        }
        if (input.buffer.length > UploadConfig.limits.maxSizeBytes) {
          throw new AppError(
            ErrorCodes.VALIDATION_ERROR,
            "Ukuran berkas melebihi batas maksimal 5 MB",
            400,
          );
        }
        const cleanMime = input.contentType.split(";")[0]?.trim() ?? "";
        if (!isAllowedMimeType(cleanMime)) {
          throw new AppError(
            ErrorCodes.VALIDATION_ERROR,
            "Format berkas tidak didukung (hanya png, jpg, jpeg, webp)",
            400,
          );
        }
        rawBytes = input.buffer;
      }

      const compressed = await compressToTemplateWebp(rawBytes);
      const key = `templates/${generateTemplateCuid()}.webp`;

      await storage.put({
        key,
        body: compressed.body,
        contentType: compressed.contentType,
      });

      const url = await urlOf(key);
      return {
        key,
        url,
        width: compressed.width,
        height: compressed.height,
      };
    },

    async customerList(
      userId: string,
      q: CustomerListQuery,
    ): Promise<{
      items: CustomerTemplateView[];
      page: number;
      limit: number;
      hasMore: boolean;
    }> {
      const userSpicyEnabled = await assertUserSpicyFlag(userId);
      const isSpicy = resolveSpicyScope(q.spicy, userSpicyEnabled);

      const where: Prisma.TemplateWhereInput = {
        isActive: true,
        isSpicy,
        ...(q.category !== null ? { category: q.category } : {}),
        ...(q.q !== null
          ? {
              OR: [
                { title: { contains: q.q, mode: "insensitive" } },
                { prompt: { contains: q.q, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const rows = await db.template.findMany({
        where,
        orderBy: buildCustomerOrderBy(q.sort),
        skip: (q.page - 1) * q.limit,
        take: q.limit + 1,
        include: { images: { orderBy: { position: "asc" } } },
      });

      const pageSlice = toPage(rows, q.limit);
      const items = await Promise.all(pageSlice.items.map((row) => toCustomerView(row, urlOf)));

      return {
        items,
        page: q.page,
        limit: q.limit,
        hasMore: pageSlice.hasMore,
      };
    },

    async customerCategories(
      userId: string,
      spicy: boolean,
    ): Promise<{ categories: string[] }> {
      const userSpicyEnabled = await assertUserSpicyFlag(userId);
      const isSpicy = resolveSpicyScope(spicy, userSpicyEnabled);

      const rows = await db.template.findMany({
        where: {
          isActive: true,
          isSpicy,
          category: { not: null },
        },
        distinct: ["category"],
        select: { category: true },
        orderBy: { category: "asc" },
      });

      const unique = new Set<string>();
      for (const row of rows) {
        const clean = row.category?.trim();
        if (clean) unique.add(clean);
      }

      const categories = Array.from(unique).sort((a, b) => a.localeCompare(b));
      return { categories };
    },

    async recordUse(userId: string, id: string): Promise<{ ok: true }> {
      const userSpicyEnabled = await assertUserSpicyFlag(userId);

      const updated = await db.template.updateMany({
        where: {
          id,
          isActive: true,
          ...(userSpicyEnabled ? {} : { isSpicy: false }),
        },
        data: {
          usageCount: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new AppError(ErrorCodes.NOT_FOUND, "Template tidak ditemukan", 404);
      }

      return { ok: true };
    },

    async getImageFile(
      userId: string,
      imageId: string,
      storage: ObjectStorage,
    ): Promise<{ body: Uint8Array; contentType: string; storageKey: string }> {
      const userSpicyEnabled = await assertUserSpicyFlag(userId);

      const image = await db.templateImage.findUnique({
        where: { id: imageId },
        include: {
          template: {
            select: {
              isActive: true,
              isSpicy: true,
            },
          },
        },
      });

      if (!image || !image.template || !image.template.isActive) {
        throw new AppError(ErrorCodes.NOT_FOUND, "Gambar template tidak ditemukan", 404);
      }

      if (image.template.isSpicy && !userSpicyEnabled) {
        throw new AppError(
          ErrorCodes.SPICY_CONSENT_REQUIRED,
          "Konten spicy memerlukan persetujuan",
          403,
        );
      }

      const file = await storage.get(image.storageKey);
      return {
        body: file.body,
        contentType: file.contentType || "image/webp",
        storageKey: image.storageKey,
      };
    },
  };
}
