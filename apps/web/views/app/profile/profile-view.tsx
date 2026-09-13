import { AccountSettings } from "./components/account-settings";
import type { CustomerProfile } from "./components/customer-home";

export function ProfilePageView({
  profile,
}: {
  profile: CustomerProfile;
}) {
  return <AccountSettings profile={profile} />;
}
