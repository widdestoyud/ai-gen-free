import { redirect } from "next/navigation";
import { CustomerHome } from "@/components/customer-home";
import { PageShell } from "@/components/page-shell";
import { auth } from "@/auth";
import { loadCustomerProfile } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function CustomerPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const profile = await loadCustomerProfile();
  if (!profile) {
    redirect("/");
  }

  return (
    <PageShell kicker="Pelanggan" title="Akun">
      <CustomerHome profile={profile.user} />
    </PageShell>
  );
}
