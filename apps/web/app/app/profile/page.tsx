import { redirect } from "next/navigation";
import { Title } from "@mantine/core";
import { CustomerHome } from "@/components/customer-home";
import { loadCustomerProfile } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function AppProfilePage() {
  const profile = await loadCustomerProfile();
  if (!profile) {
    redirect("/");
  }

  return (
    <>
      <Title order={2} mb="md">
        Profile
      </Title>
      <CustomerHome profile={profile.user} />
    </>
  );
}
