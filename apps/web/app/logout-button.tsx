"use client";

import { Button } from "@mantine/core";
import { useRouter } from "next/navigation";
import { logoutUser } from "@/lib/auth-actions";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="default"
      mt="sm"
      onClick={async () => {
        await logoutUser();
        router.refresh();
      }}
    >
      Keluar
    </Button>
  );
}
