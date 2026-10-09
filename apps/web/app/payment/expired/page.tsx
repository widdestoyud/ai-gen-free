import type { Metadata } from "next";
import { PaymentExpiredView } from "@/views/payment";

export const metadata: Metadata = {
  title: "Batas Waktu Pembayaran Berakhir | satulabs.id",
  description: "Sesi transaksi pembayaran Anda telah kedaluwarsa (expired).",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PaymentExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string; invoice_id?: string; external_id?: string; id?: string }>;
}) {
  const sp = await searchParams;
  const invoiceId = sp.invoice || sp.invoice_id || sp.external_id || sp.id || "";
  return <PaymentExpiredView invoiceId={invoiceId} />;
}
