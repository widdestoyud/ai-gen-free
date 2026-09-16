/**
 * Mapping tabel endpoint Frontend (Next.js /api/*) ke Backend API (Fastify kanonik).
 * 
 * Struktur:
 * - FE: Path yang dipanggil dari browser / Next.js client
 * - BE: Path kanonik yang dihandle oleh Fastify API backend
 * - method: HTTP Method (GET, POST, PATCH, PUT, DELETE, atau ALL)
 * - description: Deskripsi fungsi endpoint
 */

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | "ALL";

export type ApiRouteMapping = {
  FE: string;
  BE: string;
  method?: HttpMethod;
  description?: string;
};

export const API_MAPPINGS: readonly ApiRouteMapping[] = [
  // -------------------------------------------------------------
  // 1. Media, Library & Jobs
  // -------------------------------------------------------------
  {
    FE: "/api/generate",
    BE: "/jobs",
    method: "POST",
    description: "Submit request job generate baru",
  },
  {
    FE: "/api/generate",
    BE: "/customer/generated-lists",
    method: "GET",
    description: "Daftar job generate pengguna",
  },
  {
    FE: "/api/generate/:id",
    BE: "/customer/generated/:id",
    method: "ALL",
    description: "Detail data job generate spesifik dan update alias (PATCH)",
  },
  {
    FE: "/api/customer/generated/:id",
    BE: "/customer/generated/:id",
    method: "ALL",
    description: "Detail data job generate spesifik dan update alias (kanonik)",
  },
  {
    FE: "/api/generate/:id/file",
    BE: "/customer/generated/:id/file",
    method: "GET",
    description: "Unduh file biner hasil render job",
  },
  {
    FE: "/api/library",
    BE: "/customer/library",
    method: "GET",
    description: "Daftar riwayat seluruh media (generated image/video dan uploaded images) pelanggan dengan batas 20 per halaman",
  },
  {
    FE: "/api/customer/library",
    BE: "/customer/library",
    method: "GET",
    description: "Daftar riwayat seluruh media pelanggan (kanonik)",
  },
  {
    FE: "/api/jobs",
    BE: "/customer/generated-lists",
    method: "GET",
    description: "Daftar job generate pengguna (alias)",
  },
  {
    FE: "/api/jobs/:id",
    BE: "/customer/generated/:id",
    method: "ALL",
    description: "Detail data job generate spesifik dan update alias (alias)",
  },
  {
    FE: "/api/jobs/:id/file",
    BE: "/customer/generated/:id/file",
    method: "GET",
    description: "Unduh file biner hasil render job (alias)",
  },
  {
    FE: "/api/jobs",
    BE: "/jobs",
    method: "POST",
    description: "Submit request job generate gambar baru (alias)",
  },
  {
    FE: "/api/generate/siray/:modelSlug",
    BE: "/generate/siray/:modelSlug",
    method: "POST",
    description: "Submit generate langsung ke adapter Siray",
  },

  // -------------------------------------------------------------
  // 2. Auth & Pelanggan (Registrasi, OTP, Reset Password)
  // -------------------------------------------------------------
  {
    FE: "/api/user/register",
    BE: "/customer/register",
    method: "POST",
    description: "Registrasi pelanggan baru (whitelist gmail, yahoo, ymail)",
  },
  {
    FE: "/api/customer/register",
    BE: "/customer/register",
    method: "POST",
    description: "Registrasi pelanggan baru (alias kanonik)",
  },
  {
    FE: "/api/user/login",
    BE: "/customer/login",
    method: "POST",
    description: "Login pelanggan dengan email & password",
  },
  {
    FE: "/api/customer/login",
    BE: "/customer/login",
    method: "POST",
    description: "Login pelanggan kanonik",
  },
  {
    FE: "/api/user/logout",
    BE: "/customer/logout",
    method: "POST",
    description: "Logout sesi pelanggan",
  },
  {
    FE: "/api/auth/logout",
    BE: "/customer/logout",
    method: "POST",
    description: "Logout sesi auth pelanggan",
  },
  {
    FE: "/api/auth/otp",
    BE: "/auth/otp",
    method: "POST",
    description: "Request / kirim ulang kode OTP ke email",
  },
  {
    FE: "/api/auth/otp/request",
    BE: "/auth/otp",
    method: "POST",
    description: "Request kode OTP ke email (alias)",
  },
  {
    FE: "/api/auth/otp/verify",
    BE: "/auth/otp-validation",
    method: "POST",
    description: "Validasi kode OTP pelanggan",
  },
  {
    FE: "/api/auth/otp-validation",
    BE: "/auth/otp-validation",
    method: "POST",
    description: "Validasi kode OTP kanonik",
  },
  {
    FE: "/api/auth/email-validation",
    BE: "/auth/email-validation",
    method: "POST",
    description: "Validasi token verifikasi email pelanggan",
  },
  {
    FE: "/api/auth/password-reset",
    BE: "/auth/password-reset",
    method: "POST",
    description: "Permintaan reset password via email",
  },
  {
    FE: "/api/auth/password-reset-validation",
    BE: "/auth/password-reset-validation",
    method: "POST",
    description: "Validasi token reset password",
  },
  {
    FE: "/api/auth/password-reset-confirm",
    BE: "/auth/password-reset-confirm",
    method: "POST",
    description: "Konfirmasi penyimpanan kata sandi baru",
  },
  {
    FE: "/api/customer/password-change",
    BE: "/customer/password-change",
    method: "POST",
    description: "Ganti kata sandi pelanggan dengan verifikasi kata sandi lama",
  },
  {
    FE: "/api/user/password-change",
    BE: "/customer/password-change",
    method: "POST",
    description: "Ganti kata sandi pelanggan (alias)",
  },

  // -------------------------------------------------------------
  // 3. Profil Pelanggan
  // -------------------------------------------------------------
  {
    FE: "/api/user/profile",
    BE: "/customer/profile",
    method: "ALL",
    description: "Ambil (GET) dan ubah (PATCH/PUT) profil pelanggan (IDOR safe)",
  },
  {
    FE: "/api/customer/profile",
    BE: "/customer/profile",
    method: "ALL",
    description: "Ambil dan update profil pelanggan (kanonik)",
  },
  {
    FE: "/api/me",
    BE: "/customer/profile",
    method: "GET",
    description: "Data user & nextGenerateAt profil pelanggan",
  },

  // -------------------------------------------------------------
  // 4. Saldo Koin, Paket & Invoice Topup
  // -------------------------------------------------------------
  {
    FE: "/api/wallet",
    BE: "/customer/coin",
    method: "GET",
    description: "Cek saldo koin (available & held)",
  },
  {
    FE: "/api/wallet/ledger",
    BE: "/customer/coin/ledger",
    method: "GET",
    description: "Daftar mutasi riwayat koin pengguna",
  },
  {
    FE: "/api/catalog/generate",
    BE: "/customer/models",
    method: "GET",
    description: "Daftar model AI generator yang aktif",
  },
  {
    FE: "/api/catalog/topup",
    BE: "/customer/packages",
    method: "GET",
    description: "Daftar paket pembelian koin topup",
  },
  {
    FE: "/api/invoices",
    BE: "/invoices",
    method: "ALL",
    description: "Buat (POST) dan daftar (GET) invoice topup",
  },
  {
    FE: "/api/invoices/:id",
    BE: "/invoices/:id",
    method: "GET",
    description: "Detail tagihan invoice spesifik",
  },
  {
    FE: "/api/invoices/:id/proof",
    BE: "/invoices/:id/proof",
    method: "POST",
    description: "Unggah bukti transfer pembayaran invoice",
  },
  {
    FE: "/api/invoices/:id/cancel",
    BE: "/invoices/:id/cancel",
    method: "POST",
    description: "Batalkan tagihan invoice yang belum dibayar oleh pelanggan",
  },
  {
    FE: "/api/customer/invoices/:id/cancel",
    BE: "/invoices/:id/cancel",
    method: "POST",
    description: "Batalkan tagihan invoice pelanggan (kanonik)",
  },

  // -------------------------------------------------------------
  // 5. Admin Portal
  // -------------------------------------------------------------
  {
    FE: "/api/admin/login",
    BE: "/admin/login",
    method: "POST",
    description: "Login admin dengan username & password",
  },
  {
    FE: "/api/admin/me",
    BE: "/admin/me",
    method: "GET",
    description: "Identitas sesi admin yang sedang login",
  },
  {
    FE: "/api/admin/auth/logout",
    BE: "/admin/logout",
    method: "POST",
    description: "Logout sesi admin",
  },
  {
    FE: "/api/admin/users",
    BE: "/admin/users",
    method: "GET",
    description: "Daftar seluruh pengguna terdaftar",
  },
  {
    FE: "/api/admin/users/:id",
    BE: "/admin/users/:id",
    method: "GET",
    description: "Detail profil user spesifik untuk admin",
  },
  {
    FE: "/api/admin/users/:id/wallet/adjust",
    BE: "/admin/topup/poin/:id",
    method: "POST",
    description: "Penyesuaian saldo poin user secara manual oleh admin",
  },
  {
    FE: "/api/admin/models",
    BE: "/admin/models",
    method: "GET",
    description: "Daftar konfigurasi model AI di admin",
  },
  {
    FE: "/api/admin/models/:id",
    BE: "/admin/model/:id",
    method: "PATCH",
    description: "Ubah status aktif/nonaktif model AI",
  },
  {
    FE: "/api/admin/invoices",
    BE: "/admin/invoices",
    method: "GET",
    description: "Daftar invoice pembelian koin untuk kurasi",
  },
  {
    FE: "/api/admin/invoices/:id/proof",
    BE: "/admin/invoices/:id/proof",
    method: "GET",
    description: "URL bukti bayar invoice untuk admin",
  },
  {
    FE: "/api/admin/invoices/:id/file",
    BE: "/admin/invoices/:id/file",
    method: "GET",
    description: "Stream biner bukti bayar invoice",
  },
  {
    FE: "/api/admin/invoices/:id/approve",
    BE: "/admin/invoices/:id/approve",
    method: "POST",
    description: "Setujui pembayaran invoice & kreditkan poin",
  },
  {
    FE: "/api/admin/invoices/:id/reject",
    BE: "/admin/invoices/:id/reject",
    method: "POST",
    description: "Tolak invoice pembayaran",
  },
  {
    FE: "/api/admin/invoices/:id/cancel",
    BE: "/admin/invoices/:id/cancel",
    method: "POST",
    description: "Batalkan tagihan invoice oleh admin",
  },
  {
    FE: "/api/admin/invoices/:id/payment-status",
    BE: "/admin/invoices/:id/payment-status",
    method: "GET",
    description: "Cek status pembayaran Midtrans invoice oleh admin",
  },
  {
    FE: "/api/admin/notifications",
    BE: "/admin/notifications",
    method: "GET",
    description: "Jumlah dan item notifikasi pembayaran pending",
  },
  {
    FE: "/api/admin/audit",
    BE: "/admin/audit",
    method: "GET",
    description: "Riwayat log audit perubahan admin",
  },
  {
    FE: "/api/admin/packages",
    BE: "/admin/packages",
    method: "GET",
    description: "Daftar seluruh paket topup poin untuk dikonfigurasi admin",
  },
  {
    FE: "/api/admin/packages",
    BE: "/admin/packages",
    method: "POST",
    description: "Membuat paket topup baru oleh admin",
  },
  {
    FE: "/api/admin/packages/:id",
    BE: "/admin/packages/:id",
    method: "GET",
    description: "Detail paket topup poin admin",
  },
  {
    FE: "/api/admin/packages/:id",
    BE: "/admin/packages/:id",
    method: "PATCH",
    description: "Memperbarui data dan konfigurasi paket topup oleh admin",
  },
  {
    FE: "/api/admin/packages/:id",
    BE: "/admin/packages/:id",
    method: "DELETE",
    description: "Menghapus paket topup oleh admin",
  },

  // -------------------------------------------------------------
  // 6. Uploads (Pelanggan & Admin)
  // -------------------------------------------------------------
  {
    FE: "/api/customer-uploads",
    BE: "/customer/uploads",
    method: "POST",
    description: "Unggah gambar referensi pelanggan (multipart/form-data)",
  },
  {
    FE: "/api/customer-uploads/:id",
    BE: "/customer/uploads/:id",
    method: "ALL",
    description: "Operasi berkas gambar spesifik pelanggan (DELETE soft delete, PATCH update alias)",
  },
  {
    FE: "/api/customer-uploads/:id/file",
    BE: "/customer/uploads/:id/file",
    method: "GET",
    description: "Stream berkas gambar upload pelanggan",
  },
  {
    FE: "/api/customer-images",
    BE: "/customer/uploads",
    method: "GET",
    description: "Daftar riwayat berkas gambar unggahan pelanggan",
  },
  {
    FE: "/api/customer-images/:id",
    BE: "/customer/uploads/:id",
    method: "ALL",
    description: "Operasi berkas gambar spesifik pelanggan (alias)",
  },
  {
    FE: "/api/customer-images/:id/file",
    BE: "/customer/uploads/:id/file",
    method: "GET",
    description: "Stream berkas gambar upload pelanggan (alias)",
  },
  {
    FE: "/api/customer/uploads",
    BE: "/customer/uploads",
    method: "ALL",
    description: "Unggah (POST) dan daftar (GET) riwayat berkas gambar pelanggan (kanonik)",
  },
  {
    FE: "/api/customer/uploads/:id",
    BE: "/customer/uploads/:id",
    method: "ALL",
    description: "Operasi berkas gambar spesifik pelanggan (DELETE soft delete, PATCH update alias)",
  },
  {
    FE: "/api/customer/uploads/:id/file",
    BE: "/customer/uploads/:id/file",
    method: "GET",
    description: "Stream berkas gambar upload pelanggan (kanonik)",
  },
  {
    FE: "/api/admin/uploads",
    BE: "/admin/uploads",
    method: "ALL",
    description: "Unggah (POST) dan daftar (GET) gambar admin",
  },
  {
    FE: "/api/admin/uploads/:id",
    BE: "/admin/uploads/:id",
    method: "ALL",
    description: "Operasi berkas gambar spesifik admin (DELETE soft delete, PATCH update alias)",
  },
  {
    FE: "/api/admin/uploads/:id/file",
    BE: "/admin/uploads/:id/file",
    method: "GET",
    description: "Stream berkas gambar upload admin",
  },
  {
    FE: "/api/admin/uploads/sync",
    BE: "/admin/uploads/sync",
    method: "POST",
    description: "Sinkronisasi berkas gambar dari object storage ke database",
  },

  // -------------------------------------------------------------
  // 7. Payment Gateway (Midtrans)
  // -------------------------------------------------------------
  {
    FE: "/api/invoices/:id/pay",
    BE: "/invoices/:id/pay",
    method: "POST",
    description: "Initiate pembayaran Midtrans Snap untuk invoice",
  },
  {
    FE: "/api/invoices/:id/payment-status",
    BE: "/invoices/:id/payment-status",
    method: "GET",
    description: "Cek status pembayaran invoice dari Midtrans",
  },
  {
    FE: "/api/invoices/:id/payment-info",
    BE: "/invoices/:id/payment-info",
    method: "GET",
    description: "Detail invoice dengan info pembayaran Midtrans",
  },
  {
    FE: "/api/payment/methods",
    BE: "/payment/methods",
    method: "GET",
    description: "Daftar metode pembayaran yang tersedia",
  },
  {
    FE: "/api/webhooks/midtrans",
    BE: "/webhooks/midtrans",
    method: "POST",
    description: "Webhook untuk menerima notifikasi dari Midtrans",
  },

  // -------------------------------------------------------------
  // 8. System & Health
  // -------------------------------------------------------------
  {
    FE: "/api/health",
    BE: "/api/health",
    method: "GET",
    description: "Pemeriksaan kesehatan sistem backend",
  },
] as const;

/**
 * Menerjemahkan path dari Frontend (misalnya '/api/library' atau '/api/jobs/123')
 * ke path Backend kanonik Fastify (misalnya '/customer/generated-lists' atau '/customer/generated/123').
 */
export function resolveBackendPath(fePath: string, method = "GET"): string {
  const m = method.toUpperCase();
  const q = fePath.indexOf("?");
  const search = q >= 0 ? fePath.slice(q) : "";
  let path = q >= 0 ? fePath.slice(0, q) : fePath;

  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (!path.startsWith("/")) path = `/${path}`;

  // 1. Cek exact match dari tabel mapping
  for (const item of API_MAPPINGS) {
    if (item.method && item.method !== "ALL" && item.method !== m) continue;
    if (item.FE === path) {
      return item.BE + search;
    }
  }

  // 2. Cek pattern parameterized (misal :id)
  // GET /api/generate/:id/file -> /customer/generated/:id/file
  const generateFileMatch = m === "GET" ? path.match(/^\/api\/generate\/([^/]+)\/file$/) : null;
  if (generateFileMatch) return `/customer/generated/${generateFileMatch[1]}/file` + search;

  // GET /api/generate/:id -> /customer/generated/:id (kecuali endpoint adapter spesifik /api/generate/siray/...)
  const generateDetailMatch =
    m === "GET" && !path.startsWith("/api/generate/siray/") ? path.match(/^\/api\/generate\/([^/]+)$/) : null;
  if (generateDetailMatch) return `/customer/generated/${generateDetailMatch[1]}` + search;

  // GET /api/jobs/:id/file -> /customer/generated/:id/file
  const jobFileMatch = m === "GET" ? path.match(/^\/api\/jobs\/([^/]+)\/file$/) : null;
  if (jobFileMatch) return `/customer/generated/${jobFileMatch[1]}/file` + search;

  // GET /api/jobs/:id -> /customer/generated/:id
  const jobDetailMatch = m === "GET" ? path.match(/^\/api\/jobs\/([^/]+)$/) : null;
  if (jobDetailMatch) return `/customer/generated/${jobDetailMatch[1]}` + search;

  // POST /api/admin/users/:id/wallet/adjust -> /admin/topup/poin/:id
  const adjustMatch = m === "POST" ? path.match(/^\/api\/admin\/users\/([^/]+)\/wallet\/adjust$/) : null;
  if (adjustMatch) return `/admin/topup/poin/${adjustMatch[1]}` + search;

  // PATCH /api/admin/models/:id -> /admin/model/:id
  const modelPatchMatch = (m === "PATCH" || m === "PUT") ? path.match(/^\/api\/admin\/models\/([^/]+)$/) : null;
  if (modelPatchMatch) return `/admin/model/${modelPatchMatch[1]}` + search;

  // GET /api/admin/users/:id -> /admin/users/:id
  const adminUserMatch = m === "GET" ? path.match(/^\/api\/admin\/users\/([^/]+)$/) : null;
  if (adminUserMatch) return `/admin/users/${adminUserMatch[1]}` + search;

  // GET /api/invoices/:id/proof -> /admin/invoices/:id/proof (atau customer)
  const invoiceProofMatch = m === "GET" ? path.match(/^\/api\/admin\/invoices\/([^/]+)\/proof$/) : null;
  if (invoiceProofMatch) return `/admin/invoices/${invoiceProofMatch[1]}/proof` + search;

  const invoiceFileMatch = m === "GET" ? path.match(/^\/api\/admin\/invoices\/([^/]+)\/file$/) : null;
  if (invoiceFileMatch) return `/admin/invoices/${invoiceFileMatch[1]}/file` + search;

  const invoiceApproveMatch = m === "POST" ? path.match(/^\/api\/admin\/invoices\/([^/]+)\/approve$/) : null;
  if (invoiceApproveMatch) return `/admin/invoices/${invoiceApproveMatch[1]}/approve` + search;

  const invoiceRejectMatch = m === "POST" ? path.match(/^\/api\/admin\/invoices\/([^/]+)\/reject$/) : null;
  if (invoiceRejectMatch) return `/admin/invoices/${invoiceRejectMatch[1]}/reject` + search;

  const invoiceCancelMatch = m === "POST" ? path.match(/^\/api\/admin\/invoices\/([^/]+)\/cancel$/) : null;
  if (invoiceCancelMatch) return `/admin/invoices/${invoiceCancelMatch[1]}/cancel` + search;

  const adminInvoicePaymentStatus = m === "GET" ? path.match(/^\/api\/admin\/invoices\/([^/]+)\/payment-status$/) : null;
  if (adminInvoicePaymentStatus) return `/admin/invoices/${adminInvoicePaymentStatus[1]}/payment-status` + search;

  // Invoices user
  const userInvoiceProof = m === "POST" ? path.match(/^\/api\/invoices\/([^/]+)\/proof$/) : null;
  if (userInvoiceProof) return `/invoices/${userInvoiceProof[1]}/proof` + search;

  const userInvoiceCancel = m === "POST" ? path.match(/^\/api\/(?:customer\/)?invoices\/([^/]+)\/cancel$/) : null;
  if (userInvoiceCancel) return `/invoices/${userInvoiceCancel[1]}/cancel` + search;

  const userInvoiceDetail = m === "GET" ? path.match(/^\/api\/invoices\/([^/]+)$/) : null;
  if (userInvoiceDetail) return `/invoices/${userInvoiceDetail[1]}` + search;

  // Upload file streaming user & admin
  const customerUploadsFileMatch = m === "GET" ? path.match(/^\/api\/customer-uploads\/([^/]+)\/file$/) : null;
  if (customerUploadsFileMatch) return `/customer/uploads/${customerUploadsFileMatch[1]}/file` + search;

  const customerImagesFileMatch = m === "GET" ? path.match(/^\/api\/customer-images\/([^/]+)\/file$/) : null;
  if (customerImagesFileMatch) return `/customer/uploads/${customerImagesFileMatch[1]}/file` + search;

  const customerUploadFileMatch = m === "GET" ? path.match(/^\/api\/customer\/uploads\/([^/]+)\/file$/) : null;
  if (customerUploadFileMatch) return `/customer/uploads/${customerUploadFileMatch[1]}/file` + search;

  const adminUploadFileMatch = m === "GET" ? path.match(/^\/api\/admin\/uploads\/([^/]+)\/file$/) : null;
  if (adminUploadFileMatch) return `/admin/uploads/${adminUploadFileMatch[1]}/file` + search;

  // Operasi spesifik upload user (/api/customer-uploads/:id, /api/customer-images/:id, /api/customer/uploads/:id)
  const customerUploadDetailMatch = path.match(/^\/api\/(?:customer-uploads|customer-images|customer\/uploads)\/([^/]+)$/);
  if (customerUploadDetailMatch) return `/customer/uploads/${customerUploadDetailMatch[1]}` + search;

  // Fallback: strip /api jika diawali /api/
  if (path !== "/api/health" && path.startsWith("/api/")) {
    return path.slice("/api".length) + search;
  }

  return path + search;
}
