import type { Metadata } from "next";
import { Suspense } from "react";
import { GeneratePageView } from "@/views/app/generate";

export const metadata: Metadata = {
  title: "AI Studio — Generate Image & Video",
  description: "Studio pembuatan gambar dan video AI beresolusi tinggi dengan kendali kreatif penuh.",
  robots: { index: false, follow: false },
};

export default function AppGeneratePage() {
  return (
    <Suspense fallback={null}>
      <GeneratePageView />
    </Suspense>
  );
}
