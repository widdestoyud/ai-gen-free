import { AdminPageShell, AdminUnauth } from "@/views/admin/components/admin-page-shell";
import { AdminPackagesList } from "./components/packages-list";
import type { AdminPackage } from "./types";

export function AdminPackagesPageView({
  me,
  packages,
}: {
  me: unknown;
  packages: AdminPackage[];
}) {
  if (!me) return <AdminUnauth />;

  return (
    <AdminPageShell title="Katalog Paket Poin">
      <AdminPackagesList packages={packages} />
    </AdminPageShell>
  );
}
