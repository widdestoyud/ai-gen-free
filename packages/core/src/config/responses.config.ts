/**
 * Konfigurasi Terpusat untuk Respon Sukses dan Respon Error Seluruh Sistem.
 * Memudahkan pengubahan pesan, status HTTP, dan kode error di masa depan
 * tanpa mengotori controller/use case (SOLID: Single Responsibility & Open/Closed).
 */

export interface ErrorDefinition {
  code: string;
  status: number;
  message: string;
}

export interface SuccessDefinition {
  status: number;
  message: string;
}

export const AuthResponses = {
  // === RESPO ERROR ===
  errors: {
    INVALID_EMAIL: {
      code: "A001",
      status: 400,
      message: "Format email tidak valid.",
    },
    OTP_INVALID: {
      code: "A002",
      status: 400,
      message: "Kode OTP salah.",
    },
    OTP_EXPIRED: {
      code: "A003",
      status: 400,
      message: "Kode OTP telah kedaluwarsa. Silakan minta kode baru.",
    },
    OTP_LOCKED: {
      code: "A004",
      status: 429,
      message: "Kode OTP terkunci karena telah 3x salah input. Silakan minta kode baru.",
    },
    OTP_ACTIVE_EXISTING: {
      code: "A020",
      status: 429,
      message: "Kode OTP sebelumnya masih berlaku. Silakan periksa email Anda atau tunggu hingga kode kedaluwarsa sebelum meminta ulang.",
    },
    EMAIL_UNAVAILABLE: {
      code: "A005",
      status: 503,
      message: "Layanan email sedang tidak tersedia. Coba lagi nanti.",
    },
    UNAUTHENTICATED: {
      code: "A006",
      status: 401,
      message: "Sesi tidak valid atau telah berakhir. Silakan masuk kembali.",
    },
    FORBIDDEN: {
      code: "A007",
      status: 403,
      message: "Akses ditolak atau akun dinonaktifkan.",
    },
    RATE_LIMITED: {
      code: "A008",
      status: 429,
      message: "Terlalu banyak permintaan. Silakan tunggu beberapa saat.",
    },
    INVALID_EMAIL_DOMAIN: {
      code: "A010",
      status: 400,
      message: "Pendaftaran hanya diperbolehkan menggunakan email resmi @gmail.com, @yahoo.com, atau @ymail.com.",
    },
    WEAK_PASSWORD: {
      code: "A011",
      status: 400,
      message: "Kata sandi minimal 8 karakter dan harus mengandung setidaknya 1 huruf kapital dan 1 angka.",
    },
    INVALID_CREDENTIALS: {
      code: "A012",
      status: 401,
      message: "Kata sandi yang Anda masukkan salah.",
    },
    EMAIL_NOT_VERIFIED: {
      code: "A013",
      status: 403,
      message: "Email belum diverifikasi. Silakan cek kotak masuk email Anda dan lakukan verifikasi terlebih dahulu.",
    },
    EMAIL_ALREADY_REGISTERED: {
      code: "A014",
      status: 409,
      message: "Email ini sudah terdaftar. Silakan langsung masuk atau gunakan email lain.",
    },
    VERIFICATION_TOKEN_INVALID: {
      code: "A015",
      status: 400,
      message: "Tautan atau token verifikasi email tidak valid atau sudah kedaluwarsa.",
    },
    NEW_DEVICE_OTP_REQUIRED: {
      code: "A016",
      status: 200, // Informasi bahwa OTP dibutuhkan untuk perangkat baru
      message: "Login dari perangkat baru terdeteksi. Kode OTP telah dikirim ke email Anda untuk konfirmasi.",
    },
    PROFILE_INVALID: {
      code: "A017",
      status: 400,
      message: "Data profil yang dimasukkan tidak valid.",
    },
    EMAIL_NOT_FOUND: {
      code: "A018",
      status: 404,
      message: "Email tidak ditemukan atau belum terdaftar.",
    },
    ALREADY_LOGGED_IN: {
      code: "A019",
      status: 409,
      message: "Akun Anda saat ini sudah dalam keadaan masuk (login). Silakan keluar (logout) terlebih dahulu.",
    },
  } satisfies Record<string, ErrorDefinition>,

  // === RESPON SUKSES ===
  success: {
    REGISTER: {
      status: 201,
      message: "Pendaftaran berhasil. Tautan verifikasi telah dikirim ke email Anda. Silakan verifikasi sebelum masuk.",
    },
    EMAIL_VERIFIED: {
      status: 200,
      message: "Email Anda berhasil diverifikasi. Silakan masuk ke akun Anda.",
    },
    OTP_SENT: {
      status: 200,
      message: "Kode OTP verifikasi telah dikirim ke email Anda. Berlaku 10 menit.",
    },
    LOGIN_SUCCESS: {
      status: 200,
      message: "Berhasil masuk.",
    },
    OTP_VALIDATED: {
      status: 200,
      message: "Verifikasi OTP berhasil. Anda telah masuk ke sistem.",
    },
    LOGOUT_SUCCESS: {
      status: 200,
      message: "Berhasil keluar.",
    },
    ADMIN_LOGIN_SUCCESS: {
      status: 200,
      message: "Berhasil masuk sebagai admin.",
    },
    ADMIN_REGISTER_SUCCESS: {
      status: 201,
      message: "Pendaftaran admin berhasil.",
    },
    ADMIN_LOGOUT_SUCCESS: {
      status: 200,
      message: "Berhasil keluar dari sesi admin.",
    },
    PROFILE_UPDATED: {
      status: 200,
      message: "Profil berhasil diperbarui.",
    },
  } satisfies Record<string, SuccessDefinition>,
} as const;
