const LABELS: Record<string, string> = {
  queued: "Dalam antrean",
  running: "Sedang generate",
  succeeded: "Berhasil",
  failed: "Gagal",
  canceled: "Dibatalkan",
};

const ERROR_COPY: Record<string, string> = {
  W001: "Layanan generate belum siap. Poin dikembalikan, tidak ada jeda.",
  W002: "Prompt ditolak kebijakan konten. Poin dikembalikan, tidak ada jeda.",
  W003: "Generate terlalu lama. Poin dikembalikan, tidak ada jeda.",
  W004: "Generate gagal. Poin dikembalikan, tidak ada jeda.",
  W005: "Penyedia sedang gangguan. Poin dikembalikan, tidak ada jeda.",
  PROVIDER_NOT_CONFIGURED: "Layanan generate belum siap. Poin dikembalikan, tidak ada jeda.",
  PROVIDER_POLICY: "Prompt ditolak kebijakan konten. Poin dikembalikan, tidak ada jeda.",
  PROVIDER_TIMEOUT: "Generate terlalu lama. Poin dikembalikan, tidak ada jeda.",
  PROVIDER_ERROR: "Generate gagal. Poin dikembalikan, tidak ada jeda.",
  PROVIDER_UNAVAILABLE: "Penyedia sedang gangguan. Poin dikembalikan, tidak ada jeda.",
};

export type JobOutputView = {
  url: string | null;
  contentType: string;
  availableUntil: string;
  signedExpiresAt?: string | null;
};

export type JobView = {
  id: string;
  status: string;
  mode?: string;
  modelId?: string;
  prompt: string;
  cost: number;
  progressPct: number;
  errorCode: string | null;
  queuePosition?: number | null;
  createdAt?: string;
  finishedAt?: string | null;
  nextGenerateAt: string | null;
  output: JobOutputView | null;
};

export function jobStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function isJobActive(status: string): boolean {
  return status === "queued" || status === "running";
}

export function isJobTerminal(status: string): boolean {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

export function jobErrorMessage(errorCode: string | null | undefined): string {
  if (!errorCode) return "Gagal. Poin dikembalikan, tidak ada jeda.";
  return ERROR_COPY[errorCode] ?? `Gagal (${errorCode}). Poin dikembalikan, tidak ada jeda.`;
}

export function hasLiveOutput(
  output: JobOutputView | null | undefined,
): output is JobOutputView & { url: string } {
  return Boolean(output?.url);
}

export function signedRefreshDelayMs(
  output: JobOutputView | null | undefined,
  now = Date.now(),
): number | null {
  if (!output?.url) return null;
  if (output.signedExpiresAt) {
    const expires = new Date(output.signedExpiresAt).getTime();
    if (!Number.isNaN(expires)) {
      return Math.max(15_000, expires - now - 30_000);
    }
  }
  return 8 * 60 * 1000;
}

export type JobsListView = {
  jobs: JobView[];
  nextGenerateAt: string | null;
};
