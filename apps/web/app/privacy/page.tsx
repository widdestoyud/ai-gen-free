import type { Metadata } from "next";
import { PrivacyPageView } from "@/views/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy - satulabs.id",
  description: "Privacy Policy and user data protection details for satulabs.id.",
};

export default function PrivacyPage() {
  return <PrivacyPageView />;
}
