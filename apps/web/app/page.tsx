import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadCustomerProfile } from "@/lib/server-api";
import { LandingPageView } from "@/views/landing";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    const profile = await loadCustomerProfile();
    if (profile?.user) {
      redirect("/app/generate");
    }
  }

  return <LandingPageView />;
}
