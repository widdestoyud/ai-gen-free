import type { Metadata } from "next";
import { TermsPageView } from "@/views/terms";

export const metadata: Metadata = {
  title: "Terms of Service - satulabs.id",
  description: "Terms of Service and conditions covering your use of the satulabs.id studio at satulabs.id.",
};

export default function TermsPage() {
  return <TermsPageView />;
}
