import type { ObjectStorage, ObjectStorageDriver, ObjectStorageParams } from "@ai-gen-free/core";
import { MemoryObjectStorage } from "./memory.js";
import { S3CompatibleStorage, type S3CompatibleConfig } from "./s3-compatible.js";

type StorageFactory = (params: ObjectStorageParams) => ObjectStorage;

const drivers = new Map<string, StorageFactory>();

export function registerStorageDriver(name: string, factory: StorageFactory): void {
  drivers.set(name, factory);
}

registerStorageDriver("memory", () => new MemoryObjectStorage());
registerStorageDriver("minio", (params) => new S3CompatibleStorage(normalizeS3("minio", params)));
registerStorageDriver("s3", (params) => new S3CompatibleStorage(normalizeS3("s3", params)));
registerStorageDriver("r2", (params) => new S3CompatibleStorage(normalizeS3("r2", params)));

/** Ganti backend hanya dengan parameter. Service pemanggil tidak berubah. */
export function createObjectStorage(params: ObjectStorageParams): ObjectStorage {
  const driver = String(params.driver ?? "").toLowerCase();
  const factory = drivers.get(driver);
  if (!factory) {
    const known = [...drivers.keys()].sort().join(", ");
    throw new Error(`Unknown STORAGE_DRIVER "${params.driver}". Known: ${known}. Register a new adapter instead of editing callers.`);
  }
  return factory(params);
}

export function createObjectStorageFromEnv(env: NodeJS.ProcessEnv = process.env): ObjectStorage {
  return createObjectStorage(objectStorageParamsFromEnv(env));
}

export function objectStorageParamsFromEnv(env: NodeJS.ProcessEnv = process.env): ObjectStorageParams {
  const storageEndpoint = emptyToUndef(env.STORAGE_ENDPOINT);
  const s3Endpoint = emptyToUndef(env.S3_ENDPOINT);
  const explicitDriver = env.STORAGE_DRIVER?.trim().toLowerCase();
  const driver = (explicitDriver || inferStorageDriver(storageEndpoint || s3Endpoint)) as ObjectStorageDriver;
  // R2: jangan campur alias S3_* (sisa MinIO di .env).
  const alias = driver !== "r2";
  const endpoint = storageEndpoint || (alias ? s3Endpoint : undefined);
  const r2 = driver === "r2" ? splitR2Endpoint(endpoint) : undefined;
  const configuredBucket = emptyToUndef(env.STORAGE_BUCKET) || (alias ? emptyToUndef(env.S3_BUCKET) : undefined);
  const forceRaw = emptyToUndef(env.STORAGE_FORCE_PATH_STYLE) || (alias ? emptyToUndef(env.S3_FORCE_PATH_STYLE) : undefined);
  return {
    driver,
    endpoint: r2?.origin ?? endpoint,
    publicEndpoint:
      emptyToUndef(env.STORAGE_PUBLIC_ENDPOINT) || (alias ? emptyToUndef(env.S3_PUBLIC_ENDPOINT) : undefined),
    region: emptyToUndef(env.STORAGE_REGION) || (alias ? emptyToUndef(env.S3_REGION) : undefined),
    accessKeyId: emptyToUndef(env.STORAGE_ACCESS_KEY) || (alias ? emptyToUndef(env.S3_ACCESS_KEY) : undefined),
    secretAccessKey: emptyToUndef(env.STORAGE_SECRET_KEY) || (alias ? emptyToUndef(env.S3_SECRET_KEY) : undefined),
    bucket: resolveR2Bucket(configuredBucket, r2?.pathBucket) ?? configuredBucket,
    forcePathStyle: forceRaw === undefined ? undefined : forceRaw !== "false",
    signedUrlExpiresSeconds: env.STORAGE_SIGNED_URL_EXPIRES_SECONDS
      ? Number(env.STORAGE_SIGNED_URL_EXPIRES_SECONDS)
      : undefined,
  };
}

/** Jika STORAGE_DRIVER kosong: tebak dari endpoint (S3_* minio lokal vs R2). */
export function inferStorageDriver(endpoint: string | undefined): ObjectStorageDriver {
  const host = (endpoint ?? "").toLowerCase();
  if (host.includes("r2.cloudflarestorage.com") || host.includes(".r2.dev")) return "r2";
  if (host.includes("amazonaws.com")) return "s3";
  if (
    host.includes("minio") ||
    host.includes("127.0.0.1:9000") ||
    host.includes("localhost:9000")
  ) {
    return "minio";
  }
  return "r2";
}

function emptyToUndef(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** S3 API R2 = origin akun. Path di URL (mis. /ai-gen-free) = nama bucket, bukan path endpoint. */
export function splitR2Endpoint(endpoint: string | undefined): { origin?: string; pathBucket?: string } {
  if (!endpoint) return {};
  try {
    const url = new URL(endpoint);
    if (!url.hostname.endsWith(".r2.cloudflarestorage.com")) {
      return { origin: endpoint.replace(/\/+$/, "") };
    }
    const pathBucket = url.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] || undefined;
    return { origin: url.origin, pathBucket };
  } catch {
    return { origin: endpoint.replace(/\/+$/, "") };
  }
}

export function resolveR2Bucket(configured: string | undefined, pathBucket: string | undefined): string | undefined {
  if (configured && configured !== "generations") return configured;
  return pathBucket || configured;
}

function isR2PublicDevHost(endpoint: string | undefined): boolean {
  if (!endpoint) return false;
  try {
    return new URL(endpoint).hostname.endsWith(".r2.dev");
  } catch {
    return endpoint.includes(".r2.dev");
  }
}

function normalizeS3(driver: "minio" | "s3" | "r2", params: ObjectStorageParams): S3CompatibleConfig {
  const defaults = driverDefaults(driver);
  const split = driver === "r2" ? splitR2Endpoint(params.endpoint ?? defaults.endpoint) : undefined;
  const endpoint = split?.origin ?? params.endpoint ?? defaults.endpoint;
  const bucket = resolveR2Bucket(params.bucket ?? defaults.bucket, split?.pathBucket) ?? defaults.bucket;
  if (!bucket) throw new Error(`STORAGE_BUCKET is required for driver "${driver}"`);
  // r2.dev = URL publik bucket, bukan S3 API. Presign harus ke origin R2.
  const publicEndpoint =
    driver === "r2" && isR2PublicDevHost(params.publicEndpoint)
      ? endpoint
      : (params.publicEndpoint ?? rewriteDockerPublicEndpoint(endpoint) ?? defaults.publicEndpoint);
  return {
    driver,
    endpoint,
    publicEndpoint,
    region: params.region ?? defaults.region,
    accessKeyId: params.accessKeyId ?? defaults.accessKeyId,
    secretAccessKey: params.secretAccessKey ?? defaults.secretAccessKey,
    bucket,
    forcePathStyle: params.forcePathStyle ?? defaults.forcePathStyle,
  };
}

/** Hostname Docker `minio` tidak bisa dibuka browser; signed URL memakai localhost. */
export function rewriteDockerPublicEndpoint(endpoint: string | undefined): string | undefined {
  if (!endpoint) return undefined;
  try {
    const url = new URL(endpoint);
    if (url.hostname !== "minio") return endpoint;
    url.hostname = "localhost";
    if (!url.port) url.port = "9000";
    return url.toString().replace(/\/$/, "");
  } catch {
    return endpoint;
  }
}

function driverDefaults(driver: "minio" | "s3" | "r2"): {
  region: string;
  forcePathStyle: boolean;
  endpoint?: string;
  publicEndpoint?: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
} {
  if (driver === "r2") {
    return { region: "auto", forcePathStyle: false, bucket: "generations" };
  }
  if (driver === "s3") {
    return { region: "us-east-1", forcePathStyle: false, bucket: "generations" };
  }
  return {
    region: "us-east-1",
    forcePathStyle: true,
    endpoint: "http://127.0.0.1:9000",
    publicEndpoint: "http://127.0.0.1:9000",
    bucket: "generations",
    accessKeyId: "minio",
    secretAccessKey: "minio12345",
  };
}
