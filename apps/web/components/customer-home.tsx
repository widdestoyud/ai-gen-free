"use client";

import { Button, Stack, Text } from "@mantine/core";
import { AppLink } from "./app-link";
import { LogoutConfirmModal } from "./logout-confirm-modal";
import { useLogoutConfirm } from "@/hooks/use-logout-confirm";

export type CustomerProfile = {
  id: string;
  email: string;
  displayName: string | null;
  phoneNumber: string | null;
  ktp: string | null;
  address: string | null;
};

export function CustomerHome({ profile }: { profile: CustomerProfile }) {
  const logout = useLogoutConfirm();

  return (
    <Stack gap="sm">
      <Text>Masuk sebagai {profile.email}.</Text>
      {profile.displayName ? <Text>Nama: {profile.displayName}</Text> : null}
      {profile.phoneNumber ? <Text>Telepon: {profile.phoneNumber}</Text> : null}
      {profile.address ? <Text>Alamat: {profile.address}</Text> : null}
      <Text>
        <AppLink href="/wallet">Dompet</AppLink>
        {" · "}
        <AppLink href="/generate">Generate</AppLink>
      </Text>
      <Button type="button" variant="default" onClick={logout.openConfirm}>
        Keluar
      </Button>
      <LogoutConfirmModal
        opened={logout.opened}
        onClose={logout.closeConfirm}
        onConfirm={logout.confirmLogout}
        pending={logout.pending}
        error={logout.error}
      />
    </Stack>
  );
}
