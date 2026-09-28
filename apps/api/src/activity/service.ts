import type { IncomingHttpHeaders } from "node:http";
import { prisma } from "@ai-gen-free/db";
import { extractClientInfo, type ClientInfo } from "../lib/client-info.js";

export interface RecordActivityOptions {
  userId: string;
  action: string;
  req?: {
    ip?: string;
    headers?: IncomingHttpHeaders;
  };
  clientInfo?: Partial<ClientInfo>;
  metadata?: Record<string, unknown>;
}

export async function recordUserActivity(opts: RecordActivityOptions): Promise<void> {
  try {
    const extracted = opts.req ? extractClientInfo(opts.req) : {};
    const info = {
      ip: opts.clientInfo?.ip ?? extracted.ip ?? "127.0.0.1",
      provider: opts.clientInfo?.provider ?? extracted.provider ?? null,
      os: opts.clientInfo?.os ?? extracted.os ?? null,
      browser: opts.clientInfo?.browser ?? extracted.browser ?? null,
      deviceType: opts.clientInfo?.deviceType ?? extracted.deviceType ?? null,
      country: opts.clientInfo?.country ?? extracted.country ?? null,
      city: opts.clientInfo?.city ?? extracted.city ?? null,
      region: opts.clientInfo?.region ?? extracted.region ?? null,
    };

    await prisma.userActivityLog.create({
      data: {
        userId: opts.userId,
        action: opts.action,
        ip: info.ip,
        provider: info.provider,
        os: info.os,
        browser: info.browser,
        deviceType: info.deviceType,
        country: info.country,
        city: info.city,
        region: info.region,
        metadata: (opts.metadata ?? {}) as any,
      },
    });
  } catch (err) {
    // Non-blocking logger: do not fail user operation if activity log fails
    console.error("[UserActivityLog] Failed to record user activity:", err);
  }
}

export async function listUserActivities(opts: {
  userId: string;
  limit?: number;
  offset?: number;
  action?: string;
}) {
  const limit = Math.min(Math.max(1, opts.limit ?? 20), 100);
  const offset = Math.max(0, opts.offset ?? 0);

  const where: any = {
    userId: opts.userId,
  };

  if (opts.action && opts.action.trim()) {
    where.action = { contains: opts.action.trim(), mode: "insensitive" };
  }

  const [items, total] = await Promise.all([
    prisma.userActivityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.userActivityLog.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      userId: item.userId,
      action: item.action,
      ip: item.ip,
      provider: item.provider,
      os: item.os,
      browser: item.browser,
      deviceType: item.deviceType,
      country: item.country,
      city: item.city,
      region: item.region,
      metadata: item.metadata,
      createdAt: item.createdAt.toISOString(),
    })),
    total,
    limit,
    offset,
  };
}
