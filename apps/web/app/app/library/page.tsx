import type { Metadata } from "next";
import { LibraryPageView } from "@/views/app/library";

export const metadata: Metadata = {
  title: "Private Library",
  description: "Koleksi privat berkas gambar dan video yang telah Anda buat.",
  robots: { index: false, follow: false },
};

export default function AppLibraryPage() {
  return <LibraryPageView />;
}
