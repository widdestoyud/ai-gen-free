import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { fetchUserApi } from "@/lib/server-api";
import { OrderPageView, type Invoice, type Package } from "@/views/app/order";

export const metadata: Metadata = {
  title: "Beli Paket Sparks",
  description: "Pilihan paket saldo sparks tanpa langganan kartu kredit otomatis.",
  robots: { index: false, follow: false },
};

async function loadOrderData() {
  const [catalog, invoices] = await Promise.all([
    fetchUserApi("/api/catalog/topup"),
    fetchUserApi("/api/invoices"),
  ]);
  if (!catalog || !catalog.ok || !invoices || !invoices.ok) return null;
  return {
    packages: ((await catalog.json()) as { packages: Package[] }).packages,
    invoices: ((await invoices.json()) as { invoices: Invoice[] }).invoices,
  };
}

export default async function AppOrderPage() {
  const data = await loadOrderData();
  if (!data) redirect("/");
  return <OrderPageView data={data} />;
}
