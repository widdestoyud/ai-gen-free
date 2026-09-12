import type { ObjectStorage } from "@ai-gen-free/core";

export const SIGNED_SECONDS = 10 * 60;

export type OutputAsset = {
  storageKey: string;
  contentType: string;
  expiresAt: Date;
  purgedAt: Date | null;
  sha256?: string | null;
};

export type JobOutputDto = {
  url: string | null;
  contentType: string;
  availableUntil: string;
  signedExpiresAt: string | null;
};

export function isOutputAssetLive(asset: { purgedAt: Date | null; expiresAt: Date }, now: Date): boolean {
  return asset.purgedAt == null && asset.expiresAt.getTime() > now.getTime();
}

export function isOutputPurged(asset: { purgedAt: Date | null; expiresAt: Date } | undefined, now: Date): boolean {
  if (!asset) return false;
  return asset.purgedAt != null || asset.expiresAt.getTime() <= now.getTime();
}

export function promptPreview(prompt: string, max = 120): string {
  const trimmed = prompt.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

export function customerOutputPath(jobId: string): string {
  return `/api/jobs/${jobId}/file`;
}

export async function resolveJobOutput(
  status: string,
  asset: OutputAsset | undefined,
  storage: ObjectStorage,
  opts?: { now?: Date; signedSeconds?: number; jobId?: string },
): Promise<JobOutputDto | null> {
  if (status !== "succeeded" || !asset) return null;
  const now = opts?.now ?? new Date();
  const availableUntil = asset.expiresAt.toISOString();
  if (!isOutputAssetLive(asset, now)) {
    return { url: null, contentType: asset.contentType, availableUntil, signedExpiresAt: null };
  }
  const jobId = opts?.jobId;
  if (jobId) {
    return {
      url: customerOutputPath(jobId),
      contentType: asset.contentType,
      availableUntil,
      signedExpiresAt: null,
    };
  }
  const signedSeconds = opts?.signedSeconds ?? SIGNED_SECONDS;
  try {
    const url = await storage.signGetUrl(asset.storageKey, signedSeconds);
    return {
      url,
      contentType: asset.contentType,
      availableUntil,
      signedExpiresAt: new Date(now.getTime() + signedSeconds * 1000).toISOString(),
    };
  } catch {
    return { url: null, contentType: asset.contentType, availableUntil, signedExpiresAt: null };
  }
}
