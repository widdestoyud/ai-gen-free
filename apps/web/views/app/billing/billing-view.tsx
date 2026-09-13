import { Title } from "@mantine/core";
import { WalletClient } from "./components/wallet-client";
import type { Invoice, LedgerRow, Package } from "./types";

export function BillingPageView({
  data,
}: {
  data: {
    wallet: { available: number; held: number };
    packages: Package[];
    invoices: Invoice[];
    entries: LedgerRow[];
  };
}) {
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
