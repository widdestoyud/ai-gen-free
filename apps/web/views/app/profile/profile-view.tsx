"use client";

import { AccountSettings } from "./components/account-settings";
import type { CustomerProfile } from "./types";

export function ProfilePageView(props?: {
  profile?: CustomerProfile | null;
}) {
  return <AccountSettings profile={props?.profile} />;
}
