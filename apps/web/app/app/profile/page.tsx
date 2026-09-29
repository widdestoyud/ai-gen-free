import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadCustomerProfile } from "@/lib/server-api";
import { ProfilePageView } from "@/views/app/profile";

export const metadata: Metadata = {
  title: "Profil & Pengaturan Akun",
  description: "Pengaturan akun pengguna dan preferensi satulabs.id.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AppProfilePage() {
  const profile = await loadCustomerProfile();
  if (!profile) {
    redirect("/");
  }

  return <ProfilePageView profile={profile.user} />;
}
