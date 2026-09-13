import { redirect } from "next/navigation";
import { loadCustomerProfile } from "@/lib/server-api";
import { ProfilePageView } from "@/views/app/profile";

export const dynamic = "force-dynamic";

export default async function AppProfilePage() {
  const profile = await loadCustomerProfile();
  if (!profile) {
    redirect("/");
  }

  return <ProfilePageView profile={profile.user} />;
}
