import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WalletClient } from "./wallet-client";

const apiBase = () => process.env.API_INTERNAL_URL ?? "http://localhost:3001";

async function loadWallet() {
  const jar = await cookies();
  const sid = jar.get("sid")?.value;
  if (!sid) return null;
  const headers = { cookie: `sid=${sid}` };
  const [wallet, catalog, invoices, ledger] = await Promise.all([
    fetch(`${apiBase()}/api/wallet`, { headers, cache: "no-store" }),
    fetch(`${apiBase()}/api/catalog/topup`, { headers, cache: "no-store" }),
    fetch(`${apiBase()}/api/invoices`, { headers, cache: "no-store" }),
    fetch(`${apiBase()}/api/wallet/ledger`, { headers, cache: "no-store" }),
  ]);
  if (!wallet.ok) return null;
  return {
    wallet: (await wallet.json()) as { available: number; held: number },
    packages: ((await catalog.json()) as { packages: Package[] }).packages,
    invoices: ((await invoices.json()) as { invoices: Invoice[] }).invoices,
    entries: ((await ledger.json()) as { entries: LedgerRow[] }).entries,
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
    <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1.5rem" }}>
      <p>
        <Link href="/" style={{ color: "#8ab4ff" }}>
          ← Beranda
        </Link>
      </p>
      <h1>Dompet</h1>
      <WalletClient
        available={data.wallet.available}
        held={data.wallet.held}
        packages={data.packages}
        invoices={data.invoices}
        entries={data.entries}
      />
    </main>
  );
}
