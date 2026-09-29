import type { Metadata } from "next";
import { PaymentFailedView } from "@/views/payment";

export const metadata: Metadata = {
  title: "Pembayaran Belum Berhasil | satulabs.id",
  description: "Sesi transaksi pembayaran Anda belum berhasil atau telah dibatalkan.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PaymentFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string; invoice_id?: string; external_id?: string; id?: string }>;
}) {
  const sp = await searchParams;
  const invoiceId = sp.invoice || sp.invoice_id || sp.external_id || sp.id || "";
  return <PaymentFailedView invoiceId={invoiceId} />;
}
