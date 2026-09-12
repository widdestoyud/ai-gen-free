/** Teks klien untuk Job.errorCode (W00x). Bukan fail_reason Siray mentah. */
export const JOB_ERROR_MESSAGES: Record<string, string> = {
  W001: "Layanan generate belum siap. Poin dikembalikan, tidak ada jeda.",
  W002:
    "Prompt ditolak kebijakan konten penyedia. Ubah prompt lalu coba lagi. Poin dikembalikan, tidak ada jeda.",
  W003: "Generate terlalu lama. Poin dikembalikan, tidak ada jeda.",
  W004: "Generate gagal di penyedia. Poin dikembalikan, tidak ada jeda.",
  W005: "Penyedia sedang gangguan. Poin dikembalikan, tidak ada jeda.",
  W006: "Gambar jadi di penyedia, gagal disimpan ke storage. Poin dikembalikan, tidak ada jeda.",
  PROVIDER_NOT_CONFIGURED: "Layanan generate belum siap. Poin dikembalikan, tidak ada jeda.",
  PROVIDER_POLICY:
    "Prompt ditolak kebijakan konten penyedia. Ubah prompt lalu coba lagi. Poin dikembalikan, tidak ada jeda.",
  PROVIDER_TIMEOUT: "Generate terlalu lama. Poin dikembalikan, tidak ada jeda.",
  PROVIDER_ERROR: "Generate gagal di penyedia. Poin dikembalikan, tidak ada jeda.",
  PROVIDER_UNAVAILABLE: "Penyedia sedang gangguan. Poin dikembalikan, tidak ada jeda.",
  OUTPUT_COPY_FAILED: "Gambar jadi di penyedia, gagal disimpan ke storage. Poin dikembalikan, tidak ada jeda.",
};

export function jobClientErrorMessage(errorCode: string | null | undefined): string | null {
  if (!errorCode) return null;
  return JOB_ERROR_MESSAGES[errorCode] ?? `Generate gagal (${errorCode}). Poin dikembalikan, tidak ada jeda.`;
}
