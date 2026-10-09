import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Pilihan Paket & Harga - satulabs.id",
  description:
    "Pilihan paket saldo sparks tanpa langganan kartu kredit otomatis untuk generate AI video dan foto.",
};

export default function PricingPage() {
  redirect("/#pricing");
}
