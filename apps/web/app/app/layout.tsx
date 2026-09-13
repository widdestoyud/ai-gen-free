import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppWorkspace } from "@/components/app-workspace";
import { auth } from "@/auth";
import { loadCustomerProfile } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function AppSectionLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  const profile = await loadCustomerProfile();
  if (!profile?.user) {
    redirect("/");
  }
  return <AppWorkspace>{children}</AppWorkspace>;
}
