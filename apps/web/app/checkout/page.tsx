import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutView } from "@/views/checkout";
import { Loader, Center } from "@mantine/core";

export const metadata: Metadata = {
  title: "Checkout Pembayaran - satulabs.id",
  description: "Checkout pembayaran instan saldo Sparks AI tanpa ikatan langganan.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <Center style={{ minHeight: "100vh", background: "#050b14" }}>
          <Loader color="blue" size="lg" />
        </Center>
      }
    >
      <CheckoutView />
    </Suspense>
  );
}
