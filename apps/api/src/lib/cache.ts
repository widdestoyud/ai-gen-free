import type IORedis from "ioredis";
import type { Session, User } from "@prisma/client";

let cacheRedis: IORedis | null = null;

export function setCacheRedis(redis: IORedis | null | undefined): void {
  cacheRedis = redis ?? null;
}

export function getCacheRedis(): IORedis | null {
  return cacheRedis;
}

// ============================================================================
// 1. Session Cache
// ============================================================================
const SESSION_CACHE_TTL_DEFAULT = 900; // 15 minutes

export type CachedSessionData = Session & { user: User };

function deserializeSession(raw: Record<string, any>): CachedSessionData {
  return {
    ...raw,
    expiresAt: new Date(raw.expiresAt),
    createdAt: new Date(raw.createdAt),
    user: {
      ...raw.user,
      createdAt: new Date(raw.user.createdAt),
      updatedAt: new Date(raw.user.updatedAt),
      bannedAt: raw.user.bannedAt ? new Date(raw.user.bannedAt) : null,
      emailVerifiedAt: raw.user.emailVerifiedAt ? new Date(raw.user.emailVerifiedAt) : null,
      dateOfBirth: raw.user.dateOfBirth ? new Date(raw.user.dateOfBirth) : null,
      uploadPolicyAcceptedAt: raw.user.uploadPolicyAcceptedAt ? new Date(raw.user.uploadPolicyAcceptedAt) : null,
      spicyModeAcceptedAt: raw.user.spicyModeAcceptedAt ? new Date(raw.user.spicyModeAcceptedAt) : null,
      lastLoginAt: raw.user.lastLoginAt ? new Date(raw.user.lastLoginAt) : null,
    },
  } as CachedSessionData;
}

export async function getCachedSession(tokenHash: string): Promise<CachedSessionData | null> {
  if (!cacheRedis) return null;
  try {
    const raw = await cacheRedis.get(`cache:session:${tokenHash}`);
    if (!raw) return null;
    return deserializeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function setCachedSession(
  tokenHash: string,
  session: CachedSessionData,
): Promise<void> {
  if (!cacheRedis) return;
  try {
    const remainingSeconds = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
    const ttl = Math.min(SESSION_CACHE_TTL_DEFAULT, Math.max(1, remainingSeconds));
    await Promise.all([
      cacheRedis.set(`cache:session:${tokenHash}`, JSON.stringify(session), "EX", ttl),
      cacheRedis.set(`user:session:${session.userId}:${session.kind}`, tokenHash, "EX", ttl),
    ]);
  } catch {}
}

export async function invalidateSession(tokenHash: string): Promise<void> {
  if (!cacheRedis) return;
  try {
    await cacheRedis.del(`cache:session:${tokenHash}`);
  } catch {}
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  if (!cacheRedis) return;
  try {
    const [hashUser, hashAdmin] = await Promise.all([
      cacheRedis.get(`user:session:${userId}:user`).catch(() => null),
      cacheRedis.get(`user:session:${userId}:admin`).catch(() => null),
    ]);
    const keysToDelete: string[] = [
      `user:session:${userId}:user`,
      `user:session:${userId}:admin`,
    ];
    if (hashUser) keysToDelete.push(`cache:session:${hashUser}`);
    if (hashAdmin) keysToDelete.push(`cache:session:${hashAdmin}`);
    await cacheRedis.del(...keysToDelete);
  } catch {}
}

// ============================================================================
// 2. Model Catalog Cache
// ============================================================================
const CATALOG_CACHE_TTL = 3600; // 1 hour

export async function getCachedCustomerCatalog<T>(): Promise<T | null> {
  if (!cacheRedis) return null;
  try {
    const raw = await cacheRedis.get("cache:catalog:customer");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setCachedCustomerCatalog<T>(catalog: T): Promise<void> {
  if (!cacheRedis) return;
  try {
    await cacheRedis.set("cache:catalog:customer", JSON.stringify(catalog), "EX", CATALOG_CACHE_TTL);
  } catch {}
}

export async function getCachedEnabledModels<T>(): Promise<T | null> {
  if (!cacheRedis) return null;
  try {
    const raw = await cacheRedis.get("cache:catalog:enabled");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setCachedEnabledModels<T>(rows: T): Promise<void> {
  if (!cacheRedis) return;
  try {
    await cacheRedis.set("cache:catalog:enabled", JSON.stringify(rows), "EX", CATALOG_CACHE_TTL);
  } catch {}
}

export async function invalidateModelCatalogCache(): Promise<void> {
  if (!cacheRedis) return;
  try {
    await cacheRedis.del("cache:catalog:customer", "cache:catalog:enabled");
  } catch {}
}

// ============================================================================
// 3. App Settings Cache
// ============================================================================
const SETTINGS_CACHE_TTL = 3600; // 1 hour

export async function getCachedAppSetting<T>(key: string): Promise<T | null> {
  if (!cacheRedis) return null;
  try {
    const raw = await cacheRedis.get(`cache:setting:${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setCachedAppSetting<T>(key: string, value: T): Promise<void> {
  if (!cacheRedis) return;
  try {
    await cacheRedis.set(`cache:setting:${key}`, JSON.stringify(value), "EX", SETTINGS_CACHE_TTL);
  } catch {}
}

export async function invalidateAppSetting(key: string): Promise<void> {
  if (!cacheRedis) return;
  try {
    await cacheRedis.del(`cache:setting:${key}`);
  } catch {}
}
