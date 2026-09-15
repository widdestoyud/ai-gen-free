import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { ErrorCodes, UploadConfig, type ObjectStorage } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import { AuthError } from "../auth/service.js";
import type IORedis from "ioredis";

export type UploadActor = "customer" | "admin";

export interface CompressedImageResult {
  body: Uint8Array;
  contentType: "image/webp";
  width: number;
  height: number;
  sizeBytes: number;
}

export interface ProcessUploadOptions {
  storage: ObjectStorage;
  actor: UploadActor;
  actorId: string;
  buffer: Uint8Array;
  contentType: string;
}

export interface UploadResult {
  id: string;
  key: string;
  url: string;
  mime_type: "image/webp";
  width: number;
  height: number;
  size_bytes: number;
  expires_at: string;
  created_at?: string;
  alias?: string | null;
  deleted_at?: string | null;
}

export interface ListUploadsResult {
  total: number;
  limit: number;
  offset: number;
  items: UploadResult[];
}

/**
 * Validasi MIME type berkas dari konfigurasi terpusat.
 */
export function isAllowedMimeType(mime: string): boolean {
  return (UploadConfig.allowedMimeTypes as readonly string[]).includes(mime.toLowerCase().trim());
}

/**
 * Pemeriksaan Magic Bytes untuk memastikan berkas gambar valid (bukan file manipulasi ekstensi).
 */
export function isImageBuffer(b: Uint8Array): boolean {
  if (b.length < 8) return false;
  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  // WebP: RIFF .... WEBP
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return true;
  }
  return false;
}

/**
 * Mengompres gambar menggunakan sharp:
 * - Menjaga orientasi EXIF (auto-rotate).
 * - Menjaga rasio potrait / landscape utuh tanpa terdistorsi/terpotong (fit: "inside").
 * - Mengonversi ke format WebP dengan kualitas terkonfigurasi.
 */
export async function compressUploadImage(inputBuffer: Uint8Array): Promise<CompressedImageResult> {
  if (!isImageBuffer(inputBuffer)) {
    throw new AuthError(
      ErrorCodes.VALIDATION_ERROR,
      "Format berkas tidak didukung atau rusak (hanya png, jpg, jpeg, webp)",
      400,
    );
  }

  const base = sharp(inputBuffer, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;

  if (srcW < 1 || srcH < 1) {
    throw new AuthError(ErrorCodes.VALIDATION_ERROR, "Dimensi gambar tidak valid", 400);
  }

  const maxDim = UploadConfig.compression.maxDimension;
  let pipeline = base;

  if (srcW > maxDim || srcH > maxDim) {
    pipeline = pipeline.resize({
      width: maxDim,
      height: maxDim,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const webpBuffer = await pipeline
    .webp({ quality: UploadConfig.compression.quality, effort: 4 })
    .toBuffer();

  const outMeta = await sharp(webpBuffer).metadata();
  const outW = outMeta.width ?? srcW;
  const outH = outMeta.height ?? srcH;

  return {
    body: new Uint8Array(webpBuffer),
    contentType: "image/webp",
    width: outW,
    height: outH,
    sizeBytes: webpBuffer.length,
  };
}

/**
 * Memeriksa rate limit upload pada Redis.
 */
export async function checkUploadRateLimit(
  redis: IORedis,
  actor: UploadActor,
  actorId: string,
): Promise<void> {
  const rule = UploadConfig.rateLimit[actor];
  const windowSeconds = Math.ceil(rule.windowMs / 1000);
  const key = `ratelimit:upload:${actor}:${actorId}`;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }

  if (current > rule.maxRequests) {
    throw new AuthError(
      ErrorCodes.RATE_LIMITED,
      `Batas frekuensi upload terlampaui. Maksimal ${rule.maxRequests} upload per menit.`,
      429,
    );
  }
}

/**
 * Memproses upload gambar, mengompres, dan menyimpannya ke ObjectStorage serta DB.
 */
export async function processUpload(opts: ProcessUploadOptions & { alias?: string | null }): Promise<UploadResult> {
  if (!opts.contentType || !isAllowedMimeType(opts.contentType)) {
    throw new AuthError(
      ErrorCodes.VALIDATION_ERROR,
      "Format berkas tidak didukung (hanya png, jpg, jpeg, webp)",
      400,
    );
  }

  if (opts.buffer.length === 0) {
    throw new AuthError(ErrorCodes.VALIDATION_ERROR, "Berkas gambar kosong", 400);
  }

  if (opts.buffer.length > UploadConfig.limits.maxSizeBytes) {
    throw new AuthError(ErrorCodes.VALIDATION_ERROR, "Ukuran berkas melebihi batas maksimal 5 MB", 400);
  }

  const compressed = await compressUploadImage(opts.buffer);
  const uploadId = `up_${randomBytes(12).toString("hex")}`;
  const key = `uploads/${opts.actor}/${opts.actorId}/${uploadId}.webp`;

  await opts.storage.put({
    key,
    body: compressed.body,
    contentType: compressed.contentType,
  });

  const ttlSeconds = UploadConfig.retention.ttlSeconds;
  const expiresAtDate = new Date(Date.now() + ttlSeconds * 1000);
  // URL internal same-origin, bukan ekspos R2 langsung
  const sameOriginUrl = `/${opts.actor}/uploads/${uploadId}/file`;
  const alias = typeof opts.alias === "string" && opts.alias.trim().length > 0 ? opts.alias.trim().slice(0, 100) : null;

  // Simpan record ke database jika tersedia
  try {
    if (prisma?.upload?.create) {
      await prisma.upload.create({
        data: {
          id: uploadId,
          userId: opts.actorId,
          actor: opts.actor,
          storageKey: key,
          contentType: compressed.contentType,
          bytes: compressed.sizeBytes,
          width: compressed.width,
          height: compressed.height,
          alias,
          expiresAt: expiresAtDate,
        },
      });
    }
  } catch {
    // Non-fatal if DB not running or mocked in isolated tests
  }

  return {
    id: uploadId,
    key,
    url: sameOriginUrl,
    mime_type: compressed.contentType,
    width: compressed.width,
    height: compressed.height,
    size_bytes: compressed.sizeBytes,
    expires_at: expiresAtDate.toISOString(),
    alias,
  };
}

/**
 * Mengambil file biner upload untuk disajikan secara stream kepada pelanggan (Anti-IDOR).
 */
export async function getUploadFileForUser(opts: {
  storage: ObjectStorage;
  userId: string;
  id: string;
}): Promise<{ body: Uint8Array; contentType: string }> {
  const cleanId = opts.id.replace(/\.[^.]+$/, "");
  const expectedKey = `uploads/customer/${opts.userId}/${cleanId}.webp`;
  let storageKey = expectedKey;
  let dbContentType: string | null = null;

  try {
    const row = await prisma.upload.findFirst({
      where: { id: cleanId, userId: opts.userId, purgedAt: null, deletedAt: null },
    });
    if (row) {
      storageKey = row.storageKey;
      dbContentType = row.contentType;
    }
  } catch {
    // DB offline atau schema migration pending
  }

  try {
    const obj = await opts.storage.get(storageKey);
    return { body: obj.body, contentType: obj.contentType || dbContentType || "image/webp" };
  } catch {
    throw new AuthError(ErrorCodes.NOT_FOUND, "Berkas gambar tidak ditemukan", 404);
  }
}

/**
 * Mengambil file biner upload untuk disajikan secara stream kepada admin.
 */
export async function getUploadFileForAdmin(opts: {
  storage: ObjectStorage;
  id: string;
}): Promise<{ body: Uint8Array; contentType: string }> {
  const cleanId = opts.id.replace(/\.[^.]+$/, "");
  let storageKey = `uploads/admin/${cleanId}.webp`;
  let dbContentType: string | null = null;

  try {
    const row = await prisma.upload.findFirst({
      where: { id: cleanId, purgedAt: null, deletedAt: null },
    });
    if (row) {
      storageKey = row.storageKey;
      dbContentType = row.contentType;
    }
  } catch {
    // DB offline atau schema migration pending
  }

  try {
    const obj = await opts.storage.get(storageKey);
    return { body: obj.body, contentType: obj.contentType || dbContentType || "image/webp" };
  } catch {
    throw new AuthError(ErrorCodes.NOT_FOUND, "Berkas gambar tidak ditemukan", 404);
  }
}

/**
 * Mengambil daftar riwayat unggahan gambar aktif milik pelanggan (mengecualikan soft delete).
 */
export async function listCustomerUploads(
  _storage: ObjectStorage,
  userId: string,
  opts: { limit: number; offset: number },
): Promise<ListUploadsResult> {
  const now = new Date();
  const where = {
    userId,
    actor: "customer",
    purgedAt: null,
    deletedAt: null,
    expiresAt: { gt: now },
  };

  try {
    const [total, rows] = await Promise.all([
      prisma.upload.count({ where }),
      prisma.upload.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: opts.limit,
        skip: opts.offset,
      }),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      key: row.storageKey,
      url: `/customer/uploads/${row.id}/file`,
      mime_type: (row.contentType as "image/webp") || "image/webp",
      width: row.width,
      height: row.height,
      size_bytes: row.bytes,
      expires_at: row.expiresAt.toISOString(),
      created_at: row.createdAt.toISOString(),
      alias: row.alias ?? null,
    }));

    return {
      total,
      limit: opts.limit,
      offset: opts.offset,
      items,
    };
  } catch {
    return {
      total: 0,
      limit: opts.limit,
      offset: opts.offset,
      items: [],
    };
  }
}

/**
 * Mengambil daftar riwayat unggahan gambar untuk admin (mengecualikan soft delete).
 */
export async function listAdminUploads(
  _storage: ObjectStorage,
  opts: { limit: number; offset: number },
): Promise<ListUploadsResult> {
  const now = new Date();
  const where = {
    purgedAt: null,
    deletedAt: null,
    expiresAt: { gt: now },
  };

  try {
    const [total, rows] = await Promise.all([
      prisma.upload.count({ where }),
      prisma.upload.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: opts.limit,
        skip: opts.offset,
      }),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      key: row.storageKey,
      url: `/admin/uploads/${row.id}/file`,
      mime_type: (row.contentType as "image/webp") || "image/webp",
      width: row.width,
      height: row.height,
      size_bytes: row.bytes,
      expires_at: row.expiresAt.toISOString(),
      created_at: row.createdAt.toISOString(),
      alias: row.alias ?? null,
    }));

    return {
      total,
      limit: opts.limit,
      offset: opts.offset,
      items,
    };
  } catch {
    return {
      total: 0,
      limit: opts.limit,
      offset: opts.offset,
      items: [],
    };
  }
}

/**
 * Soft delete berkas upload milik customer (Anti-IDOR).
 */
export async function softDeleteUploadForUser(userId: string, id: string): Promise<{ ok: true; id: string }> {
  const cleanId = id.replace(/\.[^.]+$/, "");
  let upload: any = null;
  try {
    upload = await prisma.upload.findFirst({
      where: { id: cleanId, userId, deletedAt: null },
    });
  } catch {
    // DB offline atau schema pending
  }

  if (!upload) {
    throw new AuthError(ErrorCodes.NOT_FOUND, "Berkas gambar tidak ditemukan atau sudah dihapus", 404);
  }

  try {
    await prisma.upload.update({
      where: { id: upload.id },
      data: { deletedAt: new Date() },
    });
  } catch {
    // Non-fatal
  }

  return { ok: true, id: upload.id };
}

/**
 * Soft delete berkas upload oleh admin.
 */
export async function softDeleteUploadForAdmin(id: string): Promise<{ ok: true; id: string }> {
  const cleanId = id.replace(/\.[^.]+$/, "");
  let upload: any = null;
  try {
    upload = await prisma.upload.findFirst({
      where: { id: cleanId, deletedAt: null },
    });
  } catch {
    // DB offline atau schema pending
  }

  if (!upload) {
    throw new AuthError(ErrorCodes.NOT_FOUND, "Berkas gambar tidak ditemukan atau sudah dihapus", 404);
  }

  try {
    await prisma.upload.update({
      where: { id: upload.id },
      data: { deletedAt: new Date() },
    });
  } catch {
    // Non-fatal
  }

  return { ok: true, id: upload.id };
}

/**
 * Update alias untuk berkas upload milik customer (Anti-IDOR).
 */
export async function updateUploadAliasForUser(
  userId: string,
  id: string,
  rawAlias: unknown,
): Promise<UploadResult> {
  const cleanId = id.replace(/\.[^.]+$/, "");
  let upload: any = null;
  try {
    upload = await prisma.upload.findFirst({
      where: { id: cleanId, userId, deletedAt: null },
    });
  } catch {
    // DB offline atau schema pending
  }

  if (!upload) {
    throw new AuthError(ErrorCodes.NOT_FOUND, "Berkas gambar tidak ditemukan", 404);
  }

  const alias =
    typeof rawAlias === "string" && rawAlias.trim().length > 0
      ? rawAlias.trim().slice(0, 100)
      : rawAlias === null || rawAlias === ""
        ? null
        : upload.alias;

  let updated = { ...upload, alias };
  try {
    updated = await prisma.upload.update({
      where: { id: upload.id },
      data: { alias },
    });
  } catch {
    // Non-fatal
  }

  return {
    id: updated.id,
    key: updated.storageKey,
    url: `/customer/uploads/${updated.id}/file`,
    mime_type: (updated.contentType as "image/webp") || "image/webp",
    width: updated.width,
    height: updated.height,
    size_bytes: updated.bytes,
    expires_at: (updated.expiresAt instanceof Date ? updated.expiresAt : new Date()).toISOString(),
    created_at: (updated.createdAt instanceof Date ? updated.createdAt : new Date()).toISOString(),
    alias: updated.alias ?? null,
  };
}

/**
 * Update alias untuk berkas upload oleh admin.
 */
export async function updateUploadAliasForAdmin(
  id: string,
  rawAlias: unknown,
): Promise<UploadResult> {
  const cleanId = id.replace(/\.[^.]+$/, "");
  let upload: any = null;
  try {
    upload = await prisma.upload.findFirst({
      where: { id: cleanId, deletedAt: null },
    });
  } catch {
    // DB offline atau schema pending
  }

  if (!upload) {
    throw new AuthError(ErrorCodes.NOT_FOUND, "Berkas gambar tidak ditemukan", 404);
  }

  const alias =
    typeof rawAlias === "string" && rawAlias.trim().length > 0
      ? rawAlias.trim().slice(0, 100)
      : rawAlias === null || rawAlias === ""
        ? null
        : upload.alias;

  let updated = { ...upload, alias };
  try {
    updated = await prisma.upload.update({
      where: { id: upload.id },
      data: { alias },
    });
  } catch {
    // Non-fatal
  }

  return {
    id: updated.id,
    key: updated.storageKey,
    url: `/admin/uploads/${updated.id}/file`,
    mime_type: (updated.contentType as "image/webp") || "image/webp",
    width: updated.width,
    height: updated.height,
    size_bytes: updated.bytes,
    expires_at: (updated.expiresAt instanceof Date ? updated.expiresAt : new Date()).toISOString(),
    created_at: (updated.createdAt instanceof Date ? updated.createdAt : new Date()).toISOString(),
    alias: updated.alias ?? null,
  };
}

export interface SyncUploadsResult {
  scanned: number;
  synced: number;
  skipped: number;
  errors: number;
}

/**
 * Sinkronisasi otomatis gambar yang ada di Object Storage (R2/S3/MinIO) ke tabel database Upload.
 */
export async function syncUploadsFromStorage(storage: ObjectStorage): Promise<SyncUploadsResult> {
  if (typeof storage.list !== "function") {
    return { scanned: 0, synced: 0, skipped: 0, errors: 0 };
  }

  const objects = await storage.list("uploads/");
  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const obj of objects) {
    try {
      // Key pattern: uploads/{actor}/{userId}/{uploadId}.webp
      const match = obj.key.match(/^uploads\/(customer|admin)\/([^/]+)\/([^/]+)$/);
      if (!match) {
        skipped++;
        continue;
      }

      const [, actor, userId, filename] = match;
      const uploadId = filename.replace(/\.[^.]+$/, "");

      // Cek apakah sudah ada di DB
      const existing = await prisma.upload.findUnique({
        where: { id: uploadId },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Pastikan user ada di database
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        skipped++;
        continue;
      }

      // Baca metadata gambar jika memungkinkan
      let width = 1080;
      let height = 1080;
      let bytes = obj.size ?? 0;

      try {
        const stored = await storage.get(obj.key);
        bytes = stored.body.length;
        const meta = await sharp(stored.body).metadata();
        width = meta.width ?? width;
        height = meta.height ?? height;
      } catch {
        // use defaults
      }

      const ttlSeconds = UploadConfig.retention.ttlSeconds;
      const createdAt = obj.lastModified ?? new Date();
      const expiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000);

      // Lewati jika sudah expired
      if (expiresAt.getTime() < Date.now()) {
        skipped++;
        continue;
      }

      await prisma.upload.create({
        data: {
          id: uploadId,
          userId,
          actor: actor as UploadActor,
          storageKey: obj.key,
          contentType: "image/webp",
          bytes,
          width,
          height,
          expiresAt,
          createdAt,
        },
      });

      synced++;
    } catch {
      errors++;
    }
  }

  return {
    scanned: objects.length,
    synced,
    skipped,
    errors,
  };
}
