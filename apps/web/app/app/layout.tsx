import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppWorkspace } from "@/components/app-workspace";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function AppSectionLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  return <AppWorkspace>{children}</AppWorkspace>;
}
