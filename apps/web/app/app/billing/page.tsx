import { redirect } from "next/navigation";
import { fetchUserApi } from "@/lib/server-api";
import { BillingPageView, type Invoice, type LedgerRow, type Package } from "@/views/app/billing";

async function loadWallet() {
  const [wallet, catalog, invoices, ledger] = await Promise.all([
    fetchUserApi("/api/wallet"),
    fetchUserApi("/api/catalog/topup"),
    fetchUserApi("/api/invoices"),
    fetchUserApi("/api/wallet/ledger"),
  ]);
  if (!wallet || !wallet.ok) return null;
  return {
    wallet: (await wallet.json()) as { available: number; held: number },
    packages: ((await catalog!.json()) as { packages: Package[] }).packages,
    invoices: ((await invoices!.json()) as { invoices: Invoice[] }).invoices,
    entries: ((await ledger!.json()) as { entries: LedgerRow[] }).entries,
  };
}

export default async function AppBillingPage() {
  const data = await loadWallet();
  if (!data) redirect("/");
  return <BillingPageView data={data} />;
}
