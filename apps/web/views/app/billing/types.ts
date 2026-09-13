export type Package = {
  id: string;
  amountIdr: number;
  points: number;
  label: string;
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
};

export type LedgerRow = {
  id: string;
  label: string;
  amount: number;
  createdAt: string;
};
