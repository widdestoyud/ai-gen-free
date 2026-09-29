import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminWorkspace } from "@/components/admin-workspace";
import { loadAdminMe } from "@/lib/server-api";

export const metadata: Metadata = {
  title: {
    template: "%s | Admin satulabs.id",
    default: "Admin Portal — satulabs.id",
  },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminSectionLayout({ children }: { children: ReactNode }) {
  const me = await loadAdminMe();
  if (!me?.user) {
    return children;
  }
  return <AdminWorkspace>{children}</AdminWorkspace>;
}
