import { JobErrorCodes, type ProviderStatus } from "@ai-gen-free/core";

const QUEUED = new Set(["NOT_START", "SUBMITTED", "QUEUED"]);

export function mapSirayStatus(status: string | undefined): ProviderStatus["state"] | null {
  const value = (status ?? "").toUpperCase();
  if (QUEUED.has(value)) return "queued";
  if (value === "IN_PROGRESS") return "running";
  if (value === "SUCCESS") return "succeeded";
  if (value === "FAILURE") return "failed";
  return null;
}

export function parseSirayProgress(progress: unknown): number | undefined {
  if (typeof progress === "number" && Number.isFinite(progress)) {
    return clampPct(progress);
  }
  if (typeof progress !== "string") return undefined;
  const match = progress.match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  return clampPct(Number(match[1]));
}

export function isPolicyFailCode(failCode: string | undefined): boolean {
  if (!failCode) return false;
  const compact = failCode.replace(/[^a-zA-Z]/g, "").toLowerCase();
  return (
    compact === "invalidparameter" ||
    compact === "contentpolicyviolation" ||
    compact.endsWith("sensitivecontentdetected")
  );
}

export function classifySirayFailure(failCode: string | undefined): string {
  if (isPolicyFailCode(failCode)) return JobErrorCodes.PROVIDER_POLICY;
  return JobErrorCodes.PROVIDER_ERROR;
}

export function classifySirayHttpStatus(httpStatus: number, failCode?: string): {
  retryable: boolean;
  errorCode: string;
} {
  if (httpStatus === 401 || httpStatus === 403) {
    return { retryable: false, errorCode: JobErrorCodes.PROVIDER_NOT_CONFIGURED };
  }
  if (httpStatus === 429 || httpStatus >= 500) {
    return { retryable: true, errorCode: JobErrorCodes.PROVIDER_UNAVAILABLE };
  }
  if (httpStatus >= 400 && httpStatus < 500) {
    return {
      retryable: false,
      errorCode: isPolicyFailCode(failCode) ? JobErrorCodes.PROVIDER_POLICY : JobErrorCodes.PROVIDER_ERROR,
    };
  }
  return { retryable: true, errorCode: JobErrorCodes.PROVIDER_UNAVAILABLE };
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
