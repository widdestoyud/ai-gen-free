import type IORedis from "ioredis";

export async function hitLimit(
  redis: IORedis,
  key: string,
  max: number,
  ttlSeconds: number,
): Promise<boolean> {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, ttlSeconds);
  return n > max;
}
