"use client";

import { Stack, Text } from "@mantine/core";

export type CustomerProfile = {
  id: string;
  email: string;
  displayName: string | null;
  phoneNumber: string | null;
  ktp: string | null;
  address: string | null;
};

export function CustomerHome({ profile }: { profile: CustomerProfile }) {
  return (
    <Stack gap="sm">
      <Text>Masuk sebagai {profile.email}.</Text>
      {profile.displayName ? <Text>Nama: {profile.displayName}</Text> : null}
      {profile.phoneNumber ? <Text>Telepon: {profile.phoneNumber}</Text> : null}
      {profile.address ? <Text>Alamat: {profile.address}</Text> : null}
    </Stack>
  );
}
