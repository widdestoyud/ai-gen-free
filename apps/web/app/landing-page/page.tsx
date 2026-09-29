import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadCustomerProfile } from "@/lib/server-api";
import { LandingPageView } from "@/views/landing";

export const metadata: Metadata = {
  title: "Create Without Limits",
  description:
    "Ciptakan materi visual dan video sinematik sekelas studio profesional dalam bahasa alami sehari-hari tanpa kartu kredit internasional.",
};

export const dynamic = "force-dynamic";

export default async function LandingRoutePage() {
  const session = await auth();
  if (session?.user) {
    const profile = await loadCustomerProfile();
    if (profile?.user) {
      redirect("/app/generate");
    }
  }

  return <LandingPageView />;
}
