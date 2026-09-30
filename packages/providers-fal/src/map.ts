import { JobErrorCodes, type ProviderStatus } from "@ai-gen-free/core";

export function mapFalStatus(status: string | undefined): ProviderStatus["state"] | null {
  const value = (status ?? "").toUpperCase();
  if (value === "IN_QUEUE" || value === "QUEUED") return "queued";
  if (value === "IN_PROGRESS" || value === "PROCESSING") return "running";
  if (value === "COMPLETED" || value === "OK" || value === "SUCCESS") return "succeeded";
  if (value === "FAILED" || value === "ERROR") return "failed";
  return null;
}

export function parseFalProgress(progress: unknown): number | undefined {
  if (typeof progress === "number" && Number.isFinite(progress)) {
    return clampPct(progress);
  }
  if (typeof progress !== "string") return undefined;
  const match = progress.match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  return clampPct(Number(match[1]));
}

export function isFalPolicyViolation(errorDetail: unknown): boolean {
  if (!errorDetail) return false;
  const text = (typeof errorDetail === "string" ? errorDetail : JSON.stringify(errorDetail)).toLowerCase();
  return (
    text.includes("nsfw") ||
    text.includes("content_policy") ||
    text.includes("content policy") ||
    text.includes("safety") ||
    text.includes("moderation") ||
    text.includes("sensitive") ||
    text.includes("prohibited")
  );
}

export function classifyFalFailure(errorDetail: unknown): string {
  if (isFalPolicyViolation(errorDetail)) return JobErrorCodes.PROVIDER_POLICY;
  return JobErrorCodes.PROVIDER_ERROR;
}

export function classifyFalHttpStatus(httpStatus: number, errorDetail?: unknown): {
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
      errorCode: isFalPolicyViolation(errorDetail) ? JobErrorCodes.PROVIDER_POLICY : JobErrorCodes.PROVIDER_ERROR,
    };
  }
  return { retryable: true, errorCode: JobErrorCodes.PROVIDER_UNAVAILABLE };
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
