export type LedgerRow = {
  id: string;
  type?: string;
  status?: string;
  label: string;
  amount: number;
  createdAt: string;
  invoiceId?: string | null;
  jobId?: string | null;
};
