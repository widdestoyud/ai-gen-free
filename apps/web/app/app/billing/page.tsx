import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { fetchUserApi } from "@/lib/server-api";
import { BillingPageView, type LedgerRow } from "@/views/app/billing";

export const metadata: Metadata = {
  title: "Saldo Sparks & Riwayat Mutasi",
  description: "Informasi saldo sparks, riwayat penggunaan, dan mutasi akun Anda.",
  robots: { index: false, follow: false },
};

async function loadBillingData() {
  const [wallet, ledger] = await Promise.all([
    fetchUserApi("/api/wallet"),
    fetchUserApi("/api/wallet/ledger"),
  ]);
  if (!wallet || !wallet.ok) return null;
  return {
    wallet: (await wallet.json()) as { available: number; held: number },
    entries: ((await ledger!.json()) as { entries: LedgerRow[] }).entries,
  };
}

export default async function AppBillingPage() {
  const data = await loadBillingData();
  if (!data) redirect("/");
  return <BillingPageView data={data} />;
}
