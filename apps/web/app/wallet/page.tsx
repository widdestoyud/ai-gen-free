import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { fetchUserApi } from "@/lib/server-api";
import { WalletClient } from "./wallet-client";

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

export type Package = { id: string; amountIdr: number; points: number; label: string };
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
export type LedgerRow = { id: string; label: string; amount: number; createdAt: string };

export default async function WalletPage() {
  const data = await loadWallet();
  if (!data) redirect("/login");
  return (
    <PageShell title="Dompet" backHref="/" backLabel="← Beranda" size="md">
      <WalletClient
        available={data.wallet.available}
        held={data.wallet.held}
        packages={data.packages}
        invoices={data.invoices}
        entries={data.entries}
      />
    </PageShell>
  );
}
