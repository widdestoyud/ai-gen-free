export type AdminPackage = {
  id: string;
  name: string;
  label: string;
  description?: string | null;
  amountIdr: number;
  originalAmountIdr?: number | null;
  points: number;
  active: boolean;
  sortOrder: number;
  badgeText?: string | null;
  createdAt?: string;
  updatedAt?: string;
};
