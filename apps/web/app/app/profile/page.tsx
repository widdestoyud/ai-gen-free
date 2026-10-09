import type { Metadata } from "next";
import { ProfilePageView } from "@/views/app/profile";

export const metadata: Metadata = {
  title: "Profil & Pengaturan Akun",
  description: "Pengaturan akun pengguna dan preferensi satulabs.id.",
  robots: { index: false, follow: false },
};

export default function AppProfilePage() {
  return <ProfilePageView />;
}
