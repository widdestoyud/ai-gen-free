/**
 * Payment Gateway Port
 * Abstraksi untuk payment gateway (DOKU, Midtrans, Xendit, dll)
 * Driver baru = adapter baru, tanpa if/switch di service layer.
 */

export interface CreatePaymentInput {
  /** Invoice number - unique identifier */
  invoiceNumber: string;
  /** Amount in IDR (tanpa desimal) */
  amount: number;
  /** Customer email untuk notifikasi */
  customerEmail?: string;
  /** Customer name */
  customerName?: string;
  /** Customer phone */
  customerPhone?: string;
  /** Callback URL setelah payment */
  callbackUrl?: string;
  /** Payment methods yang diizinkan (provider-specific) */
  paymentMethods?: string[];
  /** Payment due in minutes */
  paymentDueMinutes?: number;
  /** Line items untuk detail transaksi */
  lineItems?: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
}

export interface CreatePaymentResult {
  success: boolean;
  /** URL untuk redirect customer ke payment page */
  paymentUrl?: string;
  /** Token ID dari payment gateway */
  tokenId?: string;
  /** Session ID dari payment gateway */
  sessionId?: string;
  /** Expired date untuk payment */
  expiredDate?: Date;
  /** Error message jika gagal */
  error?: string;
}

export interface NotificationVerifyResult {
  /** Apakah notification valid (signature terverifikasi) */
  valid: boolean;
  /** Invoice number dari notification */
  invoiceNumber?: string;
  /** Amount dari notification */
  amount?: number;
  /** Payment status */
  status?: "SUCCESS" | "FAILED" | "PENDING";
  /** Payment channel yang digunakan (e.g., BCA VA, QRIS) */
  paymentChannel?: string;
  /** Payment method category (e.g., VIRTUAL_ACCOUNT, E-WALLET) */
  paymentMethod?: string;
  /** Error jika verification gagal */
  error?: string;
}

export interface PaymentStatusResult {
  /** Apakah order ditemukan */
  found: boolean;
  invoiceNumber?: string;
  amount?: number;
  status?: "SUCCESS" | "FAILED" | "PENDING" | "EXPIRED";
  paymentChannel?: string;
  paidAt?: Date;
  qrString?: string;
  qrUrl?: string;
  error?: string;
}

/**
 * Port untuk Payment Gateway
 * Implementasi: DokuCheckoutProvider, MidtransProvider, dll
 */
export interface PaymentGatewayPort {
  /** Provider identifier (e.g., "doku-checkout", "midtrans-snap") */
  readonly provider: string;
  
  /**
   * Buat payment session dan dapatkan checkout URL
   */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  
  /**
   * Verifikasi notification/webhook dari payment gateway
   */
  verifyNotification(
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<NotificationVerifyResult>;
  
  /**
   * Cek status payment secara manual (polling)
   */
  checkStatus(invoiceNumber: string): Promise<PaymentStatusResult>;
}

/** Payment gateway driver type */
export type PaymentGatewayDriver = "doku" | "midtrans" | "xendit" | "manual" | (string & {});
