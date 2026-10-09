import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderPageView } from "@/views/app/order";

export const metadata: Metadata = {
  title: "Beli Paket Sparks",
  description: "Pilihan paket saldo sparks tanpa langganan kartu kredit otomatis.",
  robots: { index: false, follow: false },
};

export default function AppOrderPage() {
  return (
    <Suspense fallback={null}>
      <OrderPageView />
    </Suspense>
  );
}

