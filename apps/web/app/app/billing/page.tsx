import type { Metadata } from "next";
import { Suspense } from "react";
import { BillingPageView } from "@/views/app/billing";

export const metadata: Metadata = {
  title: "Saldo Sparks & Riwayat Mutasi",
  description: "Informasi saldo sparks, riwayat penggunaan, dan mutasi akun Anda.",
  robots: { index: false, follow: false },
};

export default function AppBillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingPageView />
    </Suspense>
  );
}
