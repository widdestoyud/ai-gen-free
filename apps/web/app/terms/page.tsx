import type { Metadata } from "next";
import { TermsPageView } from "@/views/terms";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan Layanan - satulabs.id",
  description: "Syarat dan ketentuan penggunaan platform studio AI generasi satulabs.id.",
};

export default function TermsPage() {
  return <TermsPageView />;
}
