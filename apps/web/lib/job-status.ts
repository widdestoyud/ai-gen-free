const LABELS: Record<string, string> = {
  queued: "Dalam antrean",
  running: "Sedang generate",
  succeeded: "Berhasil",
  failed: "Gagal",
  canceled: "Dibatalkan",
};

const ERROR_COPY: Record<string, string> = {
  W001: "Layanan pembuatan gambar sedang dalam persiapan sistem. Poin Anda tetap aman dan tidak berkurang.",
  W002:
    "Maaf, prompt Anda belum dapat diproses karena mengandung konsep atau kata yang tidak sesuai dengan pedoman keamanan konten kami. Tenang, poin Anda tidak berkurang. Silakan sesuaikan pilihan kata pada prompt dan coba kembali.",
  W003: "Waktu pembuatan gambar melebihi batas yang ditentukan. Poin Anda telah dikembalikan secara otomatis. Silakan coba generate kembali.",
  W004: "Terjadi kendala teknis saat memproses gambar Anda. Poin Anda aman dan tidak terpotong. Silakan coba beberapa saat lagi.",
  W005: "Server kami sedang mengalami antrean yang sangat padat. Poin Anda tetap aman. Silakan tunggu sejenak dan coba kembali.",
  W006: "Gambar berhasil dibuat tetapi terjadi kendala saat menyimpan berkas. Poin Anda telah dikembalikan sepenuhnya. Silakan coba lagi.",
  W007: "Server GPU sedang mengalami antrian padat. Kredit Anda telah dikembalikan 100% otomatis. Silakan coba beberapa saat lagi.",
  PROVIDER_NOT_CONFIGURED: "Layanan pembuatan gambar sedang dalam persiapan sistem. Poin Anda tetap aman dan tidak berkurang.",
  PROVIDER_POLICY:
    "Maaf, prompt Anda belum dapat diproses karena mengandung konsep atau kata yang tidak sesuai dengan pedoman keamanan konten kami. Tenang, poin Anda tidak berkurang. Silakan sesuaikan pilihan kata pada prompt dan coba kembali.",
  PROVIDER_TIMEOUT: "Waktu pembuatan gambar melebihi batas yang ditentukan. Poin Anda telah dikembalikan secara otomatis. Silakan coba generate kembali.",
  PROVIDER_ERROR: "Terjadi kendala teknis saat memproses gambar Anda. Poin Anda aman dan tidak terpotong. Silakan coba beberapa saat lagi.",
  PROVIDER_UNAVAILABLE: "Server kami sedang mengalami antrean yang sangat padat. Poin Anda tetap aman. Silakan tunggu sejenak dan coba kembali.",
  OUTPUT_COPY_FAILED: "Gambar berhasil dibuat tetapi terjadi kendala saat menyimpan berkas. Poin Anda telah dikembalikan sepenuhnya. Silakan coba lagi.",
  CIRCUIT_BREAKER_OPEN: "Server GPU sedang mengalami antrian padat. Kredit Anda telah dikembalikan 100% otomatis. Silakan coba beberapa saat lagi.",
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
  if (errorCode && ERROR_COPY[errorCode]) {
    return ERROR_COPY[errorCode];
  }

  if (apiMessage) {
    const lower = apiMessage.toLowerCase();
    if (
      lower.includes("siray") ||
      lower.includes("terminalprovidererror") ||
      lower.includes("contentpolicy") ||
      lower.includes("sensitivecontent") ||
      lower.includes("kebijakan konten") ||
      lower.includes("prompt ditolak")
    ) {
      return "Maaf, prompt Anda belum dapat diproses karena mengandung konsep atau kata yang tidak sesuai dengan pedoman keamanan konten kami. Tenang, poin Anda tidak berkurang. Silakan sesuaikan pilihan kata pada prompt dan coba kembali.";
    }
    if (
      lower.includes("provider") ||
      lower.includes("storage") ||
      lower.includes("r2") ||
      lower.includes("http 4") ||
      lower.includes("http 5") ||
      lower.includes("kredensial") ||
      lower.includes("bucket")
    ) {
      return "Terjadi kendala teknis saat memproses gambar Anda. Poin Anda aman dan tidak terpotong. Silakan coba beberapa saat lagi.";
    }
    return apiMessage;
  }

  if (!errorCode) return "Proses generate belum berhasil. Tenang, poin Anda tidak terpotong. Silakan coba kembali.";
  return `Proses generate belum berhasil (${errorCode}). Poin Anda tetap aman dan tidak terpotong. Silakan coba kembali.`;
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

export function isJobVideo(job: JobView | { mode?: string | null; output?: { contentType?: string | null; url?: string | null } | null }): boolean {
  const mode = job.mode?.toLowerCase() ?? "";
  if (mode === "t2v" || mode === "i2v" || mode.includes("video")) return true;
  const contentType = job.output?.contentType?.toLowerCase() ?? "";
  if (contentType.startsWith("video/") || contentType.includes("mp4") || contentType.includes("webm")) return true;
  const url = job.output?.url?.toLowerCase() ?? "";
  if (url.endsWith(".mp4") || url.endsWith(".webm") || url.includes(".mp4?") || url.includes(".webm?")) return true;
  return false;
}

export function isJobImage(job: JobView | { mode?: string | null; output?: { contentType?: string | null; url?: string | null } | null }): boolean {
  return !isJobVideo(job);
}

