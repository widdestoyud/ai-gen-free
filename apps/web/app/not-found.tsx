import type { Metadata } from "next";
import { NotFoundView } from "@/views/not-found";

export const metadata: Metadata = {
  title: "404 — Halaman Tidak Ditemukan",
  description: "Halaman yang Anda cari tidak ditemukan atau telah dipindahkan.",
  robots: { index: false, follow: false },
};

export default function NotFoundPage() {
  return <NotFoundView />;
}
