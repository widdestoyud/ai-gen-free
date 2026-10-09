/**
 * React Query Keys Registry & Factory
 * Centralized list and helper factory of all React Query keys used across the application.
 * Use this file to monitor, track, and perform type-safe query caching and invalidations.
 */

export const queryKeys = {
  /**
   * Catalog Models & Defaults for AI Generation Studio
   * Endpoint: GET /api/catalog/generate (or /api/customer/models)
   */
  catalogGenerate: () => ["catalog-generate"] as const,

  /**
   * Top-Up Packages & Pricing Catalog for Checkout / Pricing
   * Endpoint: GET /api/catalog/packages
   */
  catalogPackages: () => ["catalog-topup-packages"] as const,

  /**
   * Top-Up Packages for Orders View
   * Endpoint: GET /api/catalog/packages
   */
  orderPackages: () => ["order-packages"] as const,

  /**
   * User Status, Terms, Upload Policy & Cooldown
   * Endpoint: GET /api/me
   */
  userStatus: () => ["user-status"] as const,

  /**
   * Customer Profile (Email, Name, Phone for Invoicing/Checkout)
   * Endpoint: GET /api/customer-profile
   */
  customerProfile: () => ["customer-profile"] as const,

  /**
   * User Wallet Balance (Available & Held Credits)
   * Endpoint: GET /api/wallet
   */
  wallet: () => ["wallet"] as const,

  /**
   * Billing & Credit Transaction Ledger with Pagination
   * Endpoint: GET /api/wallet/ledger
   */
  billingLedger: (params?: { page?: number }) =>
    params?.page !== undefined
      ? (["billing-ledger", { page: params.page }] as const)
      : (["billing-ledger"] as const),

  /**
   * Orders & Invoices List with Pagination
   * Endpoint: GET /api/invoices
   */
  orderInvoices: (params?: { page?: number }) =>
    params?.page !== undefined
      ? (["order-invoices", { page: params.page }] as const)
      : (["order-invoices"] as const),

  /**
   * Payment Gateway Methods / Channels
   * Endpoint: GET /api/payment/methods
   */
  paymentMethods: () => ["payment-methods"] as const,

  /**
   * Customer Media Library (Generated outputs & Uploaded references)
   * Endpoint: GET /api/customer/library
   */
  library: (params?: { type?: string; sort?: string; order?: string; q?: string }) =>
    params ? (["library", params] as const) : (["library"] as const),

  /**
   * Active and Historical Generated AI Jobs
   * Endpoint: GET /api/generate
   */
  generatedJobs: () => ["generated-jobs"] as const,
} as const;

/**
 * Static list of all root query key prefixes for inspection, debugging, and bulk invalidation.
 */
export const QUERY_KEY_REGISTRY = [
  {
    key: "catalog-generate",
    description: "Katalog model AI & konfigurasi default studio generate",
    endpoint: "GET /api/catalog/generate",
    usedIn: ["hooks/use-generate-studio.ts", "views/app/library/components/media-detail-modal.tsx"],
  },
  {
    key: "catalog-topup-packages",
    description: "Daftar paket top-up kredit untuk halaman checkout",
    endpoint: "GET /api/catalog/packages",
    usedIn: ["views/checkout/checkout-view.tsx"],
  },
  {
    key: "order-packages",
    description: "Daftar paket kredit untuk halaman pesanan/order",
    endpoint: "GET /api/catalog/packages",
    usedIn: ["views/app/order/order-view.tsx"],
  },
  {
    key: "user-status",
    description: "Status persetujuan kebijakan upload, mode spicy, dan cooldown pengguna",
    endpoint: "GET /api/me",
    usedIn: ["hooks/use-generate-studio.ts"],
  },
  {
    key: "customer-profile",
    description: "Profil pengguna (nama, email, no handphone) untuk formulir pesanan & checkout",
    endpoint: "GET /api/customer-profile",
    usedIn: ["views/checkout/checkout-view.tsx", "views/app/order/order-view.tsx", "components/app-workspace.tsx"],
  },
  {
    key: "wallet",
    description: "Saldo kredit aktif (available & held) milik pengguna",
    endpoint: "GET /api/wallet",
    usedIn: [
      "hooks/use-wallet.ts",
      "hooks/use-generate-studio.ts",
      "views/app/billing/billing-view.tsx",
      "views/app/order/order-view.tsx",
      "views/app/library/components/media-detail-modal.tsx",
      "components/app-workspace.tsx",
    ],
  },
  {
    key: "billing-ledger",
    description: "Mutasi dan riwayat transaksi kredit pengguna (dengan pagination)",
    endpoint: "GET /api/wallet/ledger",
    usedIn: ["views/app/billing/billing-view.tsx", "views/app/order/order-view.tsx"],
  },
  {
    key: "order-invoices",
    description: "Daftar invoice & transaksi pembelian kredit (dengan pagination)",
    endpoint: "GET /api/invoices",
    usedIn: ["views/app/order/order-view.tsx"],
  },
  {
    key: "payment-methods",
    description: "Metode pembayaran / payment channel aktif yang tersedia",
    endpoint: "GET /api/payment/methods",
    usedIn: ["views/checkout/checkout-view.tsx"],
  },
  {
    key: "library",
    description: "Daftar media perpustakaan (hasil generate & media unggahan pengguna)",
    endpoint: "GET /api/customer/library",
    usedIn: ["hooks/use-library.ts", "views/app/library/components/media-detail-modal.tsx"],
  },
  {
    key: "generated-jobs",
    description: "Daftar riwayat pekerjaan generate gambar/video AI & status aktif",
    endpoint: "GET /api/generate",
    usedIn: ["hooks/use-generate-studio.ts", "views/app/library/components/media-detail-modal.tsx"],
  },
] as const;

export type QueryKeyName = (typeof QUERY_KEY_REGISTRY)[number]["key"];
