import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadCustomerProfile, loadPublicPackages } from "@/lib/server-api";
import { LandingPageView } from "@/views/landing";

export const metadata: Metadata = {
  title: "Platform Studio AI Video & Photo",
  description:
    "Platform studio AI video dan photo untuk kamu yang ingin kebebasan kreasi sesungguhnya. Cukup beli sparks saat kamu butuh.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    const profile = await loadCustomerProfile();
    if (profile?.user) {
      redirect("/app/generate");
    }
  }

  const packages = await loadPublicPackages();

  return <LandingPageView packages={packages} />;
}

