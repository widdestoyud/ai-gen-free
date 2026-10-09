/**
 * DOKU Payment Gateway Types
 * Non-SNAP Direct API & DOKU Checkout specifications
 *
 * @see https://developers.doku.com/accept-payments/direct-api
 * @see https://developers.doku.com/accept-payments/doku-checkout
 */

export interface DokuConfig {
  /** DOKU Client ID retrieved from DOKU Back Office (e.g. MCH-..., BRN-...) */
  clientId: string;
  /** DOKU Secret Key / Shared Key retrieved from DOKU Back Office */
  secretKey: string;
  /** Optional Public Key if configured */
  publicKey?: string;
  /** Whether running in production mode */
  isProduction?: boolean;
  /** Optional custom base URL for API requests */
  baseUrl?: string;
  /** Optional custom notification path (e.g. /webhooks/doku) */
  notificationPath?: string;
  /** Optional allowed payment method types to restrict channels */
  paymentMethods?: string[];
}

export interface DokuLineItem {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  sku?: string;
  category?: string;
  url?: string;
  image_url?: string;
  type?: string;
}

export interface DokuCustomer {
  id?: string;
  name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  postcode?: string;
  state?: string;
  city?: string;
  country?: string;
}

export interface DokuCheckoutOrder {
  amount: number;
  invoice_number: string;
  currency?: string;
  callback_url?: string;
  callback_url_cancel?: string;
  callback_url_result?: string;
  language?: string;
  auto_redirect?: boolean;
  disable_retry_payment?: boolean;
  line_items?: DokuLineItem[];
}

export interface DokuCheckoutPayment {
  payment_due_date?: number;
  type?: "SALE" | "INSTALLMENT" | "AUTHORIZE";
  payment_method_types?: string[];
}

export interface DokuCheckoutRequest {
  order: DokuCheckoutOrder;
  payment?: DokuCheckoutPayment;
  customer?: DokuCustomer;
  additional_info?: Record<string, unknown>;
}

export interface DokuCheckoutResponse {
  message?: string[];
  response?: {
    order?: {
      amount?: string | number;
      invoice_number?: string;
      currency?: string;
      session_id?: string;
    };
    payment?: {
      payment_method_types?: string[];
      payment_due_date?: number;
      token_id?: string;
      url?: string;
      expired_date?: string;
    };
    uuid?: string | number;
  };
  error_messages?: string[];
  error?: {
    message?: string;
  };
}

export interface DokuNotificationPayload {
  service?: {
    id?: string;
    name?: string;
  };
  acquirer?: {
    id?: string;
    name?: string;
  };
  channel?: {
    id?: string;
    name?: string;
  };
  transaction?: {
    status?: "SUCCESS" | "FAILED" | "PENDING" | "EXPIRED" | "VOIDED" | "REFUNDED" | "TIMEOUT" | string;
    date?: string;
    type?: string;
    original_request_id?: string;
  };
  order?: {
    invoice_number?: string;
    amount?: number | string;
  };
  virtual_account_info?: {
    virtual_account_number?: string;
    created_date?: string;
    expired_date?: string;
  };
  card_payment?: {
    masked_card_number?: string;
    approval_code?: string;
    response_code?: string;
    response_message?: string;
    issuer?: string;
    brand?: string;
  };
  emoney_payment?: {
    approval_code?: string;
    response_code?: string;
    response_message?: string;
  };
  additional_info?: Record<string, unknown>;
}

export interface DokuCheckStatusResponse {
  order?: {
    invoice_number?: string;
    amount?: number | string;
    currency?: string;
  };
  transaction?: {
    status?: "SUCCESS" | "FAILED" | "PENDING" | "EXPIRED" | "VOIDED" | "REFUNDED" | "TIMEOUT" | string;
    date?: string;
    type?: string;
    original_request_id?: string;
  };
  channel?: {
    id?: string;
    name?: string;
  };
  service?: {
    id?: string;
    name?: string;
  };
  acquirer?: {
    id?: string;
    name?: string;
  };
  error_messages?: string[];
}
