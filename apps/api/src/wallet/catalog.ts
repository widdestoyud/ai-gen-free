export type TopupPackage = {
  id: string;
  amountIdr: number;
  points: number;
  label: string;
};

export const TOPUP_PACKAGES: TopupPackage[] = [
  { id: "p20", amountIdr: 20_000, points: 200, label: "Rp20.000 · 200 poin" },
  { id: "p50", amountIdr: 50_000, points: 500, label: "Rp50.000 · 500 poin" },
  { id: "p100", amountIdr: 100_000, points: 1_200, label: "Rp100.000 · 1.200 poin" },
];

export function findPackage(id: unknown): TopupPackage | undefined {
  if (typeof id !== "string") return undefined;
  return TOPUP_PACKAGES.find((p) => p.id === id);
}

export function qrisInstructions(uniqueCode: string, amountIdr: number): string {
  const base =
    process.env.QRIS_INSTRUCTIONS ??
    "Bayar QRIS statis sesuai nominal invoice, lalu unggah bukti di dashboard. Screenshot WhatsApp/Telegram tidak mengkredit poin.";
  return `${base} Nominal Rp${amountIdr.toLocaleString("id-ID")}. Kode: ${uniqueCode}.`;
}
