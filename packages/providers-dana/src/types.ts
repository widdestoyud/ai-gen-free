/**
 * Configuration options for the DANA payment provider.
 */
export interface DanaConfig {
  partnerId: string;
  merchantId: string;
  clientSecret: string;
  privateKey: string;
  danaPublicKey: string;
  isProduction?: boolean;
  baseUrl?: string;
  origin?: string;
  notifyPath?: string;
}

export interface DanaAmount {
  value: string;
  currency: "IDR";
}

export interface DanaUrlParam {
  url: string;
  type: "PAY_RETURN" | "NOTIFICATION";
  isDeeplink: "true" | "false";
}

export interface DanaPayOptionDetail {
  payMethod: string;
  payOption: string;
  transAmount: DanaAmount;
}

export interface DanaAdditionalInfo {
  mcc?: string;
  envInfo?: {
    terminalType: string;
  };
  order?: {
    orderTitle: string;
  };
}

export interface DanaCreateOrderRequest {
  partnerReferenceNo: string;
  merchantId: string;
  amount: DanaAmount;
  validUpTo: string;
  urlParams: DanaUrlParam[];
  payOptionDetails: DanaPayOptionDetail[];
  additionalInfo?: DanaAdditionalInfo;
}

export interface DanaCreateOrderResponse {
  responseCode: string;
  responseMessage: string;
  referenceNo?: string;
  partnerReferenceNo?: string;
  webRedirectUrl?: string;
}

export interface DanaQueryStatusRequest {
  merchantId: string;
  serviceCode: string;
  originalPartnerReferenceNo: string;
}

export interface DanaQueryStatusResponse {
  responseCode: string;
  latestTransactionStatus?: "00" | "01" | "02" | "05" | "07";
  paidTime?: string;
  amount?: DanaAmount;
}

export interface DanaNotificationPayload {
  originalPartnerReferenceNo: string;
  originalReferenceNo: string;
  latestTransactionStatus: "00" | "01" | "02" | "05" | "07";
  amount: DanaAmount;
  paidTime?: string;
}
