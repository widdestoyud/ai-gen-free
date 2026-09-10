import { redirect } from "next/navigation";
import { Title } from "@mantine/core";
import { fetchUserApi } from "@/lib/server-api";
import { WalletClient } from "../../wallet/wallet-client";
import type { Invoice, LedgerRow, Package } from "../../wallet/page";

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
  return (
    <>
      <Title order={2} mb="md">
        Billing
      </Title>
      <WalletClient
        available={data.wallet.available}
        held={data.wallet.held}
        packages={data.packages}
        invoices={data.invoices}
        entries={data.entries}
      />
    </>
  );
}
