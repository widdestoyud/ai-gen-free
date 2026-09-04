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
  const driver = (env.STORAGE_DRIVER ?? "minio").toLowerCase() as ObjectStorageDriver;
  const forceRaw = first(env, "STORAGE_FORCE_PATH_STYLE", "S3_FORCE_PATH_STYLE");
  return {
    driver,
    endpoint: first(env, "STORAGE_ENDPOINT", "S3_ENDPOINT"),
    publicEndpoint: first(env, "STORAGE_PUBLIC_ENDPOINT", "S3_PUBLIC_ENDPOINT"),
    region: first(env, "STORAGE_REGION", "S3_REGION"),
    accessKeyId: first(env, "STORAGE_ACCESS_KEY", "S3_ACCESS_KEY"),
    secretAccessKey: first(env, "STORAGE_SECRET_KEY", "S3_SECRET_KEY"),
    bucket: first(env, "STORAGE_BUCKET", "S3_BUCKET"),
    forcePathStyle: forceRaw === undefined ? undefined : forceRaw !== "false",
    signedUrlExpiresSeconds: env.STORAGE_SIGNED_URL_EXPIRES_SECONDS
      ? Number(env.STORAGE_SIGNED_URL_EXPIRES_SECONDS)
      : undefined,
  };
}

function first(env: NodeJS.ProcessEnv, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

function normalizeS3(driver: "minio" | "s3" | "r2", params: ObjectStorageParams): S3CompatibleConfig {
  const defaults = driverDefaults(driver);
  const bucket = params.bucket ?? defaults.bucket;
  if (!bucket) throw new Error(`STORAGE_BUCKET is required for driver "${driver}"`);
  return {
    driver,
    endpoint: params.endpoint ?? defaults.endpoint,
    publicEndpoint: params.publicEndpoint ?? params.endpoint ?? defaults.publicEndpoint,
    region: params.region ?? defaults.region,
    accessKeyId: params.accessKeyId ?? defaults.accessKeyId,
    secretAccessKey: params.secretAccessKey ?? defaults.secretAccessKey,
    bucket,
    forcePathStyle: params.forcePathStyle ?? defaults.forcePathStyle,
  };
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
