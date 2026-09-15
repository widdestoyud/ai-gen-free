export type Package = {
  id: string;
  amountIdr: number;
  points: number;
  label: string;
};

export type GatewayPaymentInfo = {
  provider?: string;
  paymentUrl: string;
  tokenId?: string;
  expiredAt?: string;
  paymentChannel?: string;
};

export type Invoice = {
  id: string;
  amountIdr: number;
  points: number;
  status: string;
  uniqueCode: string;
  statusLabel: string;
  instructions?: string;
  reviewNote?: string | null;
  hasProof: boolean;
  paymentMethod?: "manual" | "midtrans" | null;
  gateway?: GatewayPaymentInfo | null;
  paidAt?: string | null;
  createdAt?: string;
};
