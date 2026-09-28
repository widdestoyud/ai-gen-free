export const SANDBOX_BASE_URL = "https://api.sandbox.dana.id";
export const PRODUCTION_BASE_URL = "https://api.saas.dana.id";

export const ENDPOINTS = {
  CREATE_ORDER: "/payment-gateway/v1.0/debit/payment-host-to-host.htm",
  QUERY_STATUS: "/payment-gateway/v1.0/debit/status.htm",
};

export const TRANSACTION_STATUS = {
  SUCCESS: "00",
  PENDING_INITIATED: "01",
  PAYING: "02",
  CANCELLED: "05",
  NOT_FOUND: "07",
} as const;
