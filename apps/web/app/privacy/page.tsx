import type { Metadata } from "next";
import { PrivacyPageView } from "@/views/privacy";

export const metadata: Metadata = {
  title: "Kebijakan Privasi - ai-gen-free",
  description: "Kebijakan privasi dan perlindungan data pengguna platform ai-gen-free.",
};

export default function PrivacyPage() {
  return <PrivacyPageView />;
}
