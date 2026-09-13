import { Title } from "@mantine/core";
import { CustomerHome, type CustomerProfile } from "./components/customer-home";

export function ProfilePageView({
  profile,
}: {
  profile: CustomerProfile;
}) {
  return (
    <>
      <Title order={2} mb="md">
        Profile
      </Title>
      <CustomerHome profile={profile} />
    </>
  );
}
