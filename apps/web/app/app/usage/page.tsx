import type { Metadata } from "next";
import { UsagePageView } from "@/views/app/usage";

export const metadata: Metadata = {
  title: "Statistik Penggunaan",
  description: "Ringkasan pemakaian kuota dan statistik render media AI.",
  robots: { index: false, follow: false },
};

export default function AppUsagePage() {
  return <UsagePageView />;
}
