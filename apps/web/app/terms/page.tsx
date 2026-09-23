import type { Metadata } from "next";
import { TermsPageView } from "@/views/terms";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan Layanan - ai-gen-free",
  description: "Syarat dan ketentuan penggunaan platform studio AI generasi ai-gen-free.",
};

export default function TermsPage() {
  return <TermsPageView />;
}
