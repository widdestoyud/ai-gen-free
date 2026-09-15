"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutAdmin } from "@/lib/auth-actions";

export function useAdminLogoutConfirm() {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function openConfirm() {
    setError("");
    setOpened(true);
  }

  function closeConfirm() {
    if (!pending) setOpened(false);
  }

  async function confirmLogout() {
    setPending(true);
    setError("");
    try {
      await logoutAdmin();
      setOpened(false);
      router.push("/admin");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal keluar sesi admin");
    } finally {
      setPending(false);
    }
  }

  return { opened, openConfirm, closeConfirm, confirmLogout, pending, error };
}
