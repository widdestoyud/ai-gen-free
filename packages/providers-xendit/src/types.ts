/**
 * Xendit Types & Configuration
 * Standard types for Xendit Payment Request API v3 and Webhook Notification
 *
 * @see https://docs.xendit.co/apidocs/create-payment-request.md
 */

export interface XenditConfig {
  /** Secret API Key dari Xendit Dashboard (Settings > Developers > API Keys) */
  apiKey: string;
  /** Public API Key (opsional, untuk frontend/Payment Session) */
  publicKey?: string;
  /** Webhook verification token dari Xendit Dashboard (Settings > Webhooks) */
  webhookToken?: string;
  /** Environment mode (default: false = Test Mode) */
  isProduction?: boolean;
  /** Base URL override (opsional, default: https://api.xendit.co) */
  baseUrl?: string;
}

// ── Payment Request types ──────────────────────────────────────────────

export interface XenditPaymentMethodProperties {
  /** E-wallet channel code: OVO, DANA, SHOPEEPAY, LINKAJA, GOPAY, etc */
  channel_code?: string;
  /** Channel properties, e.g., mobile_number for OVO */
  channel_properties?: Record<string, string>;
}

export interface XenditPaymentMethod {
  type: "EWALLET" | "VIRTUAL_ACCOUNT" | "QR_CODE" | "CARD" | "DIRECT_DEBIT" | "OVER_THE_COUNTER" | (string & {});
  reusability: "ONE_TIME_USE" | "MULTIPLE_USE";
  ewallet?: XenditPaymentMethodProperties;
  virtual_account?: XenditPaymentMethodProperties & {
    channel_properties?: Record<string, string> & {
      customer_name?: string;
      expiration_date?: string;
    };
  };
  qr_code?: XenditPaymentMethodProperties;
  card?: Record<string, unknown>;
  direct_debit?: XenditPaymentMethodProperties;
  over_the_counter?: XenditPaymentMethodProperties;
}

export interface XenditCreatePaymentRequestBody {
  reference_id: string;
  type: "PAY" | "PAY_AND_SAVE" | "REUSABLE_PAYMENT_CODES";
  currency: string;
  amount: number;
  payment_method?: XenditPaymentMethod;
  description?: string;
  customer_id?: string;
  metadata?: Record<string, unknown>;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
    category?: string;
    url?: string;
  }>;
  customer?: {
    reference_id?: string;
    given_names?: string;
    surname?: string;
    email?: string;
    mobile_number?: string;
  };
}

export interface XenditPaymentRequestAction {
  action: string;
  url?: string;
  url_type?: string;
  method?: string;
  qr_code?: string;
}

export interface XenditPaymentRequestResponse {
  id: string;
  reference_id: string;
  type: string;
  currency: string;
  amount: number;
  status: string;
  payment_method: {
    id: string;
    type: string;
    reusability: string;
    status: string;
    [key: string]: unknown;
  };
  actions?: XenditPaymentRequestAction[];
  created: string;
  updated: string;
  metadata?: Record<string, unknown>;
  /** Error fields */
  error_code?: string;
  message?: string;
}

// ── Webhook Notification types ─────────────────────────────────────────

export interface XenditWebhookPayload {
  event:
    | "payment.succeeded"
    | "payment.failed"
    | "payment.pending"
    | "payment.awaiting_capture"
    | "payment_method.activated"
    | "payment_method.expired"
    | "refund.succeeded"
    | "refund.failed"
    | (string & {});
  business_id: string;
  created: string;
  data: {
    id: string;
    reference_id: string;
    currency: string;
    amount: number;
    status: string;
    payment_method?: {
      id: string;
      type: string;
      reusability?: string;
      [key: string]: unknown;
    };
    channel_code?: string;
    channel_properties?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    created?: string;
    updated?: string;
    [key: string]: unknown;
  };
  api_version?: string;
}

// ── Status Check types ─────────────────────────────────────────────────

export interface XenditPaymentStatusResponse {
  id: string;
  reference_id: string;
  type: string;
  currency: string;
  amount: number;
  status: string;
  payment_method?: {
    id: string;
    type: string;
    [key: string]: unknown;
  };
  actions?: XenditPaymentRequestAction[];
  created: string;
  updated: string;
  metadata?: Record<string, unknown>;
  /** Error fields */
  error_code?: string;
  message?: string;
}
