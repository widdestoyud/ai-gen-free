import { redirect } from "next/navigation";
import { fetchUserApi } from "@/lib/server-api";
import { BillingPageView, type LedgerRow } from "@/views/app/billing";

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
