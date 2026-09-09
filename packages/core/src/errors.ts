export const ErrorCodes = {
  // A — Auth
  INVALID_EMAIL: "A001",
  OTP_INVALID: "A002",
  OTP_EXPIRED: "A003",
  OTP_LOCKED: "A004",
  EMAIL_UNAVAILABLE: "A005",
  UNAUTHENTICATED: "A006",
  FORBIDDEN: "A007",
  RATE_LIMITED: "A008",
  INVALID_EMAIL_DOMAIN: "A010",
  WEAK_PASSWORD: "A011",
  INVALID_CREDENTIALS: "A012",
  EMAIL_NOT_VERIFIED: "A013",
  EMAIL_ALREADY_REGISTERED: "A014",
  VERIFICATION_TOKEN_INVALID: "A015",
  NEW_DEVICE_OTP_REQUIRED: "A016",
  PROFILE_INVALID: "A017",
  EMAIL_NOT_FOUND: "A018",
  ALREADY_LOGGED_IN: "A019",
  PASSWORD_RESET_PENDING: "A021",
  PASSWORD_RESET_COOLDOWN: "A022",
  PASSWORD_RESET_TOKEN_INVALID: "A023",

  // B — Generate / Job
  JOB_IN_PROGRESS: "B001",
  COOLDOWN: "B002",
  INSUFFICIENT_POINTS: "B003",

  // C — Wallet / Invoice
  INVOICE_NOT_PAYABLE: "C001",
  PROOF_REQUIRED: "C002",
  PROOF_INVALID: "C003",

  // D — Admin
  ADMIN_INVALID_PARAM: "D001",

  // E — System / Shared
  NOT_READY: "E001",
  VALIDATION_ERROR: "E002",
  NOT_FOUND: "E003",
  SYSTEM_RATE_LIMITED: "E004",
} as const;

/** Terminal Job.errorCode values written by the worker — not HTTP submit codes. */
export const JobErrorCodes = {
  PROVIDER_NOT_CONFIGURED: "W001",
  PROVIDER_POLICY: "W002",
  PROVIDER_TIMEOUT: "W003",
  PROVIDER_ERROR: "W004",
  PROVIDER_UNAVAILABLE: "W005",
} as const;

export type JobErrorCode = (typeof JobErrorCodes)[keyof typeof JobErrorCodes];

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export type ApiErrorBody = {
  transaction_id?: string;
  error: { code: string; message: string };
};
