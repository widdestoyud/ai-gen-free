const LABELS: Record<string, string> = {
  queued: "Dalam antrean",
  running: "Sedang generate",
  succeeded: "Berhasil",
  failed: "Gagal",
  canceled: "Dibatalkan",
};

const ERROR_COPY: Record<string, string> = {
  W001: "Layanan generate belum siap. Poin dikembalikan, tidak ada jeda.",
  W002: "Prompt ditolak kebijakan konten penyedia. Ubah prompt lalu coba lagi. Poin dikembalikan, tidak ada jeda.",
  W003: "Generate terlalu lama. Poin dikembalikan, tidak ada jeda.",
  W004: "Generate gagal. Poin dikembalikan, tidak ada jeda.",
  W005: "Penyedia sedang gangguan. Poin dikembalikan, tidak ada jeda.",
  W006: "Gambar jadi di Siray, gagal disimpan ke R2 (kredensial/bucket). Poin dikembalikan, tidak ada jeda.",
  PROVIDER_NOT_CONFIGURED: "Layanan generate belum siap. Poin dikembalikan, tidak ada jeda.",
  PROVIDER_POLICY:
    "Prompt ditolak kebijakan konten penyedia. Ubah prompt lalu coba lagi. Poin dikembalikan, tidak ada jeda.",
  PROVIDER_TIMEOUT: "Generate terlalu lama. Poin dikembalikan, tidak ada jeda.",
  PROVIDER_ERROR: "Generate gagal. Poin dikembalikan, tidak ada jeda.",
  PROVIDER_UNAVAILABLE: "Penyedia sedang gangguan. Poin dikembalikan, tidak ada jeda.",
  OUTPUT_COPY_FAILED: "Gambar jadi di penyedia, gagal disimpan. Poin dikembalikan, tidak ada jeda.",
};

export type JobOutputView = {
  url: string | null;
  contentType: string;
  availableUntil: string;
  signedExpiresAt?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
};

export type JobView = {
  id: string;
  status: string;
  alias?: string | null;
  mode?: string;
  modelId?: string;
  prompt: string;
  cost: number;
  progressPct: number;
  errorCode: string | null;
  errorMessage?: string | null;
  queuePosition?: number | null;
  createdAt?: string;
  finishedAt?: string | null;
  nextGenerateAt: string | null;
  params?: Record<string, unknown>;
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

export function jobErrorMessage(
  errorCode: string | null | undefined,
  apiMessage?: string | null,
): string {
  if (apiMessage) return apiMessage;
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

export type ReferenceImageItem = {
  tag: string;
  url: string;
};

export function extractReferenceImages(params?: Record<string, unknown> | null, prompt?: string): ReferenceImageItem[] {
  if (!params && !prompt) return [];
  const results: ReferenceImageItem[] = [];
  const seenUrls = new Set<string>();

  // 1. Dari params.refs
  if (params && Array.isArray(params.refs)) {
    params.refs.forEach((refItem, idx) => {
      let url = "";
      let tag = `@image${idx + 1}`;
      if (typeof refItem === "string" && refItem.trim()) {
        url = refItem.trim();
      } else if (typeof refItem === "object" && refItem !== null) {
        const obj = refItem as { url?: unknown; tag?: unknown; alias?: unknown };
        if (typeof obj.url === "string" && obj.url.trim()) {
          url = obj.url.trim();
        }
        if (typeof obj.tag === "string" && obj.tag.trim()) {
          tag = obj.tag.trim().startsWith("@") ? obj.tag.trim() : `@${obj.tag.trim()}`;
        } else if (typeof obj.alias === "string" && obj.alias.trim()) {
          tag = `@${obj.alias.trim()}`;
        }
      }

      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        results.push({ tag, url });
      }
    });
  }

  // 2. Dari params.images jika refs kosong
  if (results.length === 0 && params && Array.isArray(params.images)) {
    params.images.forEach((img, idx) => {
      if (typeof img === "string" && img.trim()) {
        const url = img.trim();
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          results.push({ tag: `@image${idx + 1}`, url });
        }
      }
    });
  }

  // 3. Dari params.image jika single image
  if (results.length === 0 && params && typeof params.image === "string" && params.image.trim()) {
    const url = params.image.trim();
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      results.push({ tag: "@image1", url });
    }
  }

  return results;
}

