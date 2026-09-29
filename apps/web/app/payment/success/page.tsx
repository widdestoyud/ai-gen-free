import type { Metadata } from "next";
import { PaymentSuccessView } from "@/views/payment";

export const metadata: Metadata = {
  title: "Pembayaran Berhasil | satulabs.id",
  description: "Pembayaran Anda telah berhasil diproses dan Sparks telah ditambahkan ke akun Anda.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string; invoice_id?: string; external_id?: string; id?: string }>;
}) {
  const sp = await searchParams;
  const invoiceId = sp.invoice || sp.invoice_id || sp.external_id || sp.id || "";
  return <PaymentSuccessView invoiceId={invoiceId} />;
}
