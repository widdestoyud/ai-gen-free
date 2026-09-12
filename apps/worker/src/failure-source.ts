export type FailureSource = "siray" | "storage" | "app";

export type ClassifiedFailure = {
  source: FailureSource;
  errorCode: string;
  message: string;
  hint: string;
};

const R2_TOKEN_HINT =
  "Buat Access Key ID + Secret Access Key di Cloudflare Dashboard → R2 object storage → Account details → API Tokens → Create Account API token (izin Object Read & Write, scope bucket). Secret hanya tampil sekali. Isi STORAGE_ACCESS_KEY dan STORAGE_SECRET_KEY di .env, lalu recreate worker/api. Bukan token My Profile → API Tokens. Docs: https://developers.cloudflare.com/r2/api/tokens/";

export function classifyJobFailure(errorCode: string, err?: unknown): ClassifiedFailure {
  const detail = errorDetail(err);
  const blob = `${errorCode} ${detail}`.toLowerCase();

  if (isStorageFailure(blob, errorCode)) {
    const credentials = /credentials|storage_access_key|invalidaccesskeyid|signaturedoesnotmatch|expiredtoken/.test(
      blob,
    );
    return {
      source: "storage",
      errorCode,
      message: credentials
        ? `Gagal storage (R2): kredensial kosong atau tidak valid. ${detail || errorCode}`
        : `Gagal storage (R2): tidak bisa menulis/membaca objek. ${detail || errorCode}`,
      hint: credentials
        ? R2_TOKEN_HINT
        : "Cek STORAGE_DRIVER=r2, STORAGE_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com (tanpa nama bucket di path), STORAGE_BUCKET, dan izin token Object Read & Write.",
    };
  }

  if (isSirayFailure(blob, errorCode)) {
    return {
      source: "siray",
      errorCode,
      message: `Gagal Siray: ${sirayMessage(errorCode, detail)}`,
      hint:
        errorCode === "W002"
          ? "Siray ContentPolicyViolation: ubah prompt. Bukan token, kuota, atau R2. GET job tetap 200 + errorCode W002 + errorMessage."
          : "Cek SIRAY_API_TOKEN, kuota/akun Siray, dan log phase=submit|poll. Gambar di Siray yang SUCCESS tidak otomatis masuk storage jika langkah copy gagal.",
    };
  }

  return {
    source: "app",
    errorCode,
    message: `Gagal aplikasi: ${detail || errorCode}`,
    hint: "Cek worker (optimize/sharp, Prisma JobAsset, wallet capture/release) dan log RESULT=failed source=app.",
  };
}

export function formatFailureLog(classified: ClassifiedFailure, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    event: "job.failed",
    source: classified.source,
    errorCode: classified.errorCode,
    message: classified.message,
    hint: classified.hint,
    ...extra,
  });
}

export function formatFailureNote(classified: ClassifiedFailure, jobId: string): string {
  return [
    `RESULT=failed jobId=${jobId}`,
    `source=${classified.source}`,
    `errorCode=${classified.errorCode}`,
    `message=${classified.message}`,
    `hint=${classified.hint}`,
  ].join(" ");
}

function isStorageFailure(blob: string, errorCode: string): boolean {
  if (/output download/.test(blob)) return false;
  if (errorCode === "W006") return true;
  return /credentials|headbucket|nosuchbucket|invalidaccesskeyid|signaturedoesnotmatch|expiredtoken|accessdenied|storage_access_key|s3compatible|could not load credentials/.test(
    blob,
  );
}

function isSirayFailure(blob: string, errorCode: string): boolean {
  if (["W001", "W002", "W003", "W004", "W005"].includes(errorCode)) return true;
  return /siray|provider_|output download|token bucket|task_id/.test(blob);
}

function sirayMessage(errorCode: string, detail: string): string {
  switch (errorCode) {
    case "W001":
      return `token/konfigurasi penyedia kosong atau ditolak (401/403). ${detail}`.trim();
    case "W002":
      return `prompt ditolak kebijakan konten. ${detail}`.trim();
    case "W003":
      return `generate melebihi batas waktu. ${detail}`.trim();
    case "W005":
      return `jaringan/429/5xx, retry habis. ${detail}`.trim();
    default:
      return detail || errorCode;
  }
}

function errorDetail(err: unknown): string {
  if (err == null) return "";
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause instanceof Error ? err.cause.message : "";
  return cause ? `${err.name}: ${err.message} (${cause})` : `${err.name}: ${err.message}`;
}
