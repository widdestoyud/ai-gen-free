"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api";

export function useLogoutConfirm() {
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
    const result = await requestJson("/api/logout", { method: "POST" });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpened(false);
    router.push("/");
    router.refresh();
  }

  return { opened, openConfirm, closeConfirm, confirmLogout, pending, error };
}
