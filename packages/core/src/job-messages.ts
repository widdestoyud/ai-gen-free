/** Teks klien untuk Job.errorCode (W00x). Bersih dari nama provider internal. */
export const JOB_ERROR_MESSAGES: Record<string, string> = {
  W001: "Layanan pembuatan gambar sedang dalam persiapan sistem. Poin Anda tetap aman dan tidak berkurang.",
  W002:
    "Maaf, prompt Anda belum dapat diproses karena mengandung konsep atau kata yang tidak sesuai dengan pedoman keamanan konten kami. Tenang, poin Anda tidak berkurang. Silakan sesuaikan pilihan kata pada prompt dan coba kembali.",
  W003: "Waktu pembuatan gambar melebihi batas yang ditentukan. Poin Anda telah dikembalikan secara otomatis. Silakan coba generate kembali.",
  W004: "Terjadi kendala teknis saat memproses gambar Anda. Poin Anda aman dan tidak terpotong. Silakan coba beberapa saat lagi.",
  W005: "Server kami sedang mengalami antrean yang sangat padat. Poin Anda tetap aman. Silakan tunggu sejenak dan coba kembali.",
  W006: "Gambar berhasil dibuat tetapi terjadi kendala saat menyimpan berkas. Poin Anda telah dikembalikan sepenuhnya. Silakan coba lagi.",
  PROVIDER_NOT_CONFIGURED: "Layanan pembuatan gambar sedang dalam persiapan sistem. Poin Anda tetap aman dan tidak berkurang.",
  PROVIDER_POLICY:
    "Maaf, prompt Anda belum dapat diproses karena mengandung konsep atau kata yang tidak sesuai dengan pedoman keamanan konten kami. Tenang, poin Anda tidak berkurang. Silakan sesuaikan pilihan kata pada prompt dan coba kembali.",
  PROVIDER_TIMEOUT: "Waktu pembuatan gambar melebihi batas yang ditentukan. Poin Anda telah dikembalikan secara otomatis. Silakan coba generate kembali.",
  PROVIDER_ERROR: "Terjadi kendala teknis saat memproses gambar Anda. Poin Anda aman dan tidak terpotong. Silakan coba beberapa saat lagi.",
  PROVIDER_UNAVAILABLE: "Server kami sedang mengalami antrean yang sangat padat. Poin Anda tetap aman. Silakan tunggu sejenak dan coba kembali.",
  OUTPUT_COPY_FAILED: "Gambar berhasil dibuat tetapi terjadi kendala saat menyimpan berkas. Poin Anda telah dikembalikan sepenuhnya. Silakan coba lagi.",
};

export function jobClientErrorMessage(errorCode: string | null | undefined): string | null {
  if (!errorCode) return null;
  return JOB_ERROR_MESSAGES[errorCode] ?? `Proses generate belum berhasil (${errorCode}). Poin Anda tetap aman. Silakan coba kembali.`;
}
