/**
 * Midtrans Types & Configuration
 * Standard types for Midtrans Snap API and HTTP Notification
 */

export interface MidtransConfig {
  /** Server Key dari Midtrans Dashboard (Access Keys) */
  serverKey: string;
  /** Client Key dari Midtrans Dashboard (Access Keys) */
  clientKey?: string;
  /** Merchant ID dari Midtrans Dashboard */
  merchantId?: string;
  /** Environment mode: sandbox | production (default: sandbox) */
  isProduction?: boolean;
  /** Base URL override (opsional) */
  snapBaseUrl?: string;
  coreApiBaseUrl?: string;
}

export interface MidtransSnapTransactionDetails {
  order_id: string;
  gross_amount: number;
}

export interface MidtransItemDetail {
  id?: string;
  price: number;
  quantity: number;
  name: string;
  brand?: string;
  category?: string;
  merchant_name?: string;
  url?: string;
}

export interface MidtransCustomerDetails {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  billing_address?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    country_code?: string;
  };
}

export interface MidtransSnapExpiry {
  start_time?: string;
  unit: "second" | "minute" | "hour" | "day";
  duration: number;
}

export interface MidtransSnapCallbacks {
  finish?: string;
}

export interface MidtransSnapRequest {
  transaction_details: MidtransSnapTransactionDetails;
  item_details?: MidtransItemDetail[];
  customer_details?: MidtransCustomerDetails;
  enabled_payments?: string[];
  expiry?: MidtransSnapExpiry;
  callbacks?: MidtransSnapCallbacks;
  custom_field1?: string;
  custom_field2?: string;
  custom_field3?: string;
}

export interface MidtransSnapResponse {
  token: string;
  redirect_url: string;
  error_messages?: string[];
}

export interface MidtransNotificationPayload {
  transaction_time: string;
  transaction_status:
    | "capture"
    | "settlement"
    | "pending"
    | "deny"
    | "cancel"
    | "expire"
    | "failure"
    | "refund"
    | "chargeback"
    | (string & {});
  transaction_id: string;
  status_message: string;
  status_code: string;
  signature_key: string;
  payment_type: string;
  order_id: string;
  merchant_id?: string;
  gross_amount: string;
  fraud_status?: "accept" | "challenge" | "deny" | (string & {});
  currency?: string;
  approval_code?: string;
  bank?: string;
  va_numbers?: Array<{
    bank: string;
    va_number: string;
  }>;
  bill_key?: string;
  biller_code?: string;
  permata_va_number?: string;
  payment_amounts?: Array<{
    paid_at: string;
    amount: string;
  }>;
}

export interface MidtransStatusResponse {
  status_code: string;
  status_message: string;
  transaction_id: string;
  order_id: string;
  gross_amount: string;
  payment_type: string;
  transaction_time: string;
  transaction_status: string;
  fraud_status?: string;
  signature_key?: string;
  settlement_time?: string;
  va_numbers?: Array<{
    bank: string;
    va_number: string;
  }>;
}
