import type { Metadata } from "next";
import { PrivacyPageView } from "@/views/privacy";

export const metadata: Metadata = {
  title: "Kebijakan Privasi - satulabs.id",
  description: "Kebijakan privasi dan perlindungan data pengguna platform satulabs.id.",
};

export default function PrivacyPage() {
  return <PrivacyPageView />;
}
