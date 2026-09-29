import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadLibrary } from "@/lib/server-api";
import { LibraryPageView } from "@/views/app/library";

export const metadata: Metadata = {
  title: "Private Library",
  description: "Koleksi privat berkas gambar dan video yang telah Anda buat.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AppLibraryPage() {
  const data = await loadLibrary();
  if (!data) {
    redirect("/");
  }

  return (
    <LibraryPageView
      initialItems={data.items}
      initialTotal={data.total}
    />
  );
}
