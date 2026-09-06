/**
 * Konfigurasi Terpusat untuk Rate Limiting Seluruh Endpoint.
 * Mengikuti prinsip Open/Closed (SOLID) agar batas percobaan & durasi jeda
 * dapat diatur dari satu sumber kebenaran tanpa mengubah kode controller.
 */

export interface RateLimitRule {
  /** Jumlah maksimal percobaan sebelum dibatasi */
  maxAttempts: number;
  /** Jendela waktu perhitungan (dalam detik) */
  windowSeconds: number;
  /** Durasi penguncian / waktu tunggu jika batas terlampaui (dalam detik) */
  lockoutSeconds: number;
  /** Pesan kustom saat terkena limit */
  message: string;
}

export const RateLimitConfig = {
  /**
   * Request / Resend OTP:
   * Maksimal 3 kali dalam 30 menit. Jika sudah 3x, harus menunggu 30 menit.
   */
  otpRequest: {
    maxAttempts: 3,
    windowSeconds: 30 * 60, // 30 menit = 1800 detik
    lockoutSeconds: 30 * 60, // 30 menit
    message: "Batas permintaan OTP tercapai (maksimal 3x). Silakan coba lagi setelah 30 menit.",
  } satisfies RateLimitRule,

  /**
   * Validasi Input OTP:
   * Maksimal 3 kali percobaan salah. Jika 3x salah, OTP dikunci / dibatalkan.
   */
  otpValidation: {
    maxAttempts: 3,
    windowSeconds: 15 * 60, // 15 menit (masa aktif challenge)
    lockoutSeconds: 30 * 60, // 30 menit
    message: "Anda telah 3x salah memasukkan OTP. Kode OTP terkunci, silakan minta kode baru.",
  } satisfies RateLimitRule,

  /**
   * Register:
   * Pembatasan per IP agar mencegah bot spam registrasi akun.
   */
  register: {
    maxAttempts: 3,
    windowSeconds: 1 * 60, // 3 pendaftaran per 15 menit per IP
    lockoutSeconds: 15 * 60,
    message: "Terlalu banyak permintaan registrasi dari IP Anda. Silakan tunggu 15 menit.",
  } satisfies RateLimitRule,

  /**
   * Login Brute-force protection:
   * Maksimal 5 percobaan gagal per IP/Email sebelum cooldown 15 menit.
   */
  login: {
    maxAttempts: 5,
    windowSeconds: 15 * 60,
    lockoutSeconds: 15 * 60,
    message: "Terlalu banyak percobaan masuk yang gagal. Silakan coba lagi setelah 15 menit.",
  } satisfies RateLimitRule,

  /**
   * Email Verification:
   * Maksimal 5 percobaan verifikasi token per 15 menit.
   */
  emailValidation: {
    maxAttempts: 5,
    windowSeconds: 15 * 60,
    lockoutSeconds: 15 * 60,
    message: "Terlalu banyak percobaan validasi email. Silakan coba lagi nanti.",
  } satisfies RateLimitRule,
} as const;
