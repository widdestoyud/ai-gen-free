import type { Metadata } from "next";
import { AdminPackagesPageView, type AdminPackage } from "@/views/admin/packages";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Katalog Paket Sparks",
  description: "Manajemen katalog paket saldo sparks dan harga promosi.",
  robots: { index: false, follow: false },
};

async function loadAdminPackages(): Promise<AdminPackage[]> {
  const res = await fetchAdminApi("/api/admin/packages");
  if (!res || !res.ok) return [];
  const data = (await res.json()) as { packages?: AdminPackage[] };
  return data.packages ?? [];
}

export default async function AdminPackagesPage() {
  const me = await loadAdminMe();
  const packages = me ? await loadAdminPackages() : [];
  return <AdminPackagesPageView me={me} packages={packages} />;
}
