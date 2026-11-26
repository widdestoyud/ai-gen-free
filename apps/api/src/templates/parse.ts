import { AppError, ErrorCodes } from "@ai-gen-free/core";

/** Regex kanonik untuk storage key aset template di bucket R2/S3. */
export const TEMPLATE_KEY_RE = /^templates\/[a-z0-9]+\.webp$/;

/** Daftar identifier model abstrak yang diizinkan pada template (tanpa nama upstream). */
export const TEMPLATE_MODEL_IDS = [
  "t2i-standard",
  "t2i-spicy",
  "i2i-standard",
  "i2i-spicy",
] as const;

const VALID_MODEL_IDS = new Set<string>(TEMPLATE_MODEL_IDS);
const VALID_ASPECT_RATIOS = new Set([
  "1:1",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "3:4",
  "4:3",
]);
const ALIAS_RE = /^[a-zA-Z0-9_]{1,24}$/;
const MAX_TITLE_LENGTH = 120;
const MAX_PROMPT_LENGTH = 4000;
const MAX_CATEGORY_LENGTH = 40;
const MAX_TEMPLATE_IMAGES = 4;
const MAX_QUERY_LENGTH = 100;

const CUSTOMER_SORTS = new Set(["default", "trending", "newest"]);
const ADMIN_SORT_FIELDS = new Set(["sortOrder", "createdAt", "usageCount", "title"]);

export type TemplateInput = {
  title: string;
  prompt: string;
  category: string | null;
  modelId: string | null;
  aspectRatio: string;
  isSpicy: boolean;
  isActive: boolean;
  sortOrder: number;
  cover: { key: string; width: number; height: number };
  images: { key: string; alias: string | null; width: number; height: number }[];
};

export type CustomerListQuery = {
  page: number;
  limit: number;
  q: string | null;
  category: string | null;
  sort: "default" | "trending" | "newest";
  spicy: boolean;
};

export type AdminListQuery = {
  page: number;
  limit: number;
  q: string | null;
  category: string | null;
  isSpicy: boolean | null;
  isActive: boolean | null;
  sortBy: "sortOrder" | "createdAt" | "usageCount" | "title";
  sortOrder: "asc" | "desc";
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireTrimmedString(value: unknown, maxLen: number, message: string): string {
  if (typeof value !== "string") {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, message);
  }
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > maxLen) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, message);
  }
  return trimmed;
}

function parseOptionalCategory(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Kategori harus berupa teks");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_CATEGORY_LENGTH) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, `Kategori maksimal ${MAX_CATEGORY_LENGTH} karakter`);
  }
  return trimmed;
}

function parseOptionalModelId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !VALID_MODEL_IDS.has(value)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "modelId template tidak valid");
  }
  return value;
}

function parseAspectRatio(value: unknown): string {
  if (value === undefined) return "1:1";
  if (typeof value !== "string" || !VALID_ASPECT_RATIOS.has(value)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "aspectRatio tidak didukung");
  }
  return value;
}

function parseOptionalBoolean(value: unknown, fallback: boolean, fieldName: string): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, `${fieldName} harus boolean`);
  }
  return value;
}

function parseOptionalInteger(value: unknown, fallback: number, fieldName: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, `${fieldName} harus bilangan bulat`);
  }
  return value;
}

function parseDimension(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, `${label} harus bilangan bulat non-negatif`);
  }
  return value;
}

function parseTemplateAssetBase(
  raw: unknown,
  label: string,
): { key: string; width: number; height: number } {
  if (!isPlainObject(raw)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, `${label} harus berupa objek`);
  }
  if (typeof raw.key !== "string" || !TEMPLATE_KEY_RE.test(raw.key)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, `Storage key ${label} tidak valid`);
  }
  return {
    key: raw.key,
    width: parseDimension(raw.width, `${label}.width`),
    height: parseDimension(raw.height, `${label}.height`),
  };
}

function parseOptionalAlias(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Alias referensi harus berupa teks");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!ALIAS_RE.test(trimmed)) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      "Alias hanya boleh huruf, angka, dan underscore (1–24 karakter)",
    );
  }
  return trimmed;
}

function parseTemplateImages(
  raw: unknown,
): { key: string; alias: string | null; width: number; height: number }[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "images harus berupa array");
  }
  if (raw.length > MAX_TEMPLATE_IMAGES) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      `Gambar referensi maksimal ${MAX_TEMPLATE_IMAGES} item`,
    );
  }
  return raw.map((item, idx) => {
    const base = parseTemplateAssetBase(item, `images[${idx}]`);
    const obj = item as Record<string, unknown>;
    return {
      ...base,
      alias: parseOptionalAlias(obj.alias),
    };
  });
}

/** Validasi dan normalisasi payload buat/ubah template dari admin. */
export function parseTemplateInput(raw: unknown): TemplateInput {
  if (!isPlainObject(raw)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Payload template harus objek");
  }

  return {
    title: requireTrimmedString(raw.title, MAX_TITLE_LENGTH, `Judul wajib diisi (1–${MAX_TITLE_LENGTH} karakter)`),
    prompt: requireTrimmedString(raw.prompt, MAX_PROMPT_LENGTH, `Prompt wajib diisi (1–${MAX_PROMPT_LENGTH} karakter)`),
    category: parseOptionalCategory(raw.category),
    modelId: parseOptionalModelId(raw.modelId),
    aspectRatio: parseAspectRatio(raw.aspectRatio),
    isSpicy: parseOptionalBoolean(raw.isSpicy, false, "isSpicy"),
    isActive: parseOptionalBoolean(raw.isActive, true, "isActive"),
    sortOrder: parseOptionalInteger(raw.sortOrder, 0, "sortOrder"),
    cover: parseTemplateAssetBase(raw.cover, "cover"),
    images: parseTemplateImages(raw.images),
  };
}

function asQueryRecord(raw: unknown): Record<string, unknown> {
  return isPlainObject(raw) ? raw : {};
}

function parseQueryInt(raw: unknown, fallback: number, min: number, max?: number): number {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  const clampedLow = Math.max(min, Math.trunc(parsed));
  return max !== undefined ? Math.min(max, clampedLow) : clampedLow;
}

function parseQueryText(raw: unknown, maxLen: number): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLen);
}

function parseQueryBoolean(raw: unknown): boolean | null {
  if (raw === true || raw === "true" || raw === "1") return true;
  if (raw === false || raw === "false" || raw === "0") return false;
  return null;
}

/** Parse query daftar galeri template untuk pelanggan dengan batas aman dan default. */
export function parseCustomerListQuery(raw: unknown): CustomerListQuery {
  const query = asQueryRecord(raw);
  const rawSort = typeof query.sort === "string" ? query.sort : "";
  const sort = CUSTOMER_SORTS.has(rawSort)
    ? (rawSort as CustomerListQuery["sort"])
    : "default";

  return {
    page: parseQueryInt(query.page, 1, 1),
    limit: parseQueryInt(query.limit, 12, 1, 24),
    q: parseQueryText(query.q, MAX_QUERY_LENGTH),
    category: parseQueryText(query.category, MAX_CATEGORY_LENGTH),
    sort,
    spicy: query.spicy === "1",
  };
}

/** Parse query daftar template untuk admin (server-side pagination, filter, sort). */
export function parseAdminListQuery(raw: unknown): AdminListQuery {
  const query = asQueryRecord(raw);
  const rawSortBy = typeof query.sortBy === "string" ? query.sortBy : "";
  const sortBy = ADMIN_SORT_FIELDS.has(rawSortBy)
    ? (rawSortBy as AdminListQuery["sortBy"])
    : "createdAt";

  const defaultSortOrder: AdminListQuery["sortOrder"] =
    sortBy === "sortOrder" || sortBy === "title" ? "asc" : "desc";
  const sortOrder: AdminListQuery["sortOrder"] =
    query.sortOrder === "asc" || query.sortOrder === "desc"
      ? query.sortOrder
      : defaultSortOrder;

  return {
    page: parseQueryInt(query.page, 1, 1),
    limit: parseQueryInt(query.limit, 20, 1, 100),
    q: parseQueryText(query.q, MAX_QUERY_LENGTH),
    category: parseQueryText(query.category, MAX_CATEGORY_LENGTH),
    isSpicy: parseQueryBoolean(query.isSpicy),
    isActive: parseQueryBoolean(query.isActive),
    sortBy,
    sortOrder,
  };
}
