"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        router.refresh();
      }}
      style={{
        marginTop: 12,
        padding: "8px 12px",
        borderRadius: 8,
        border: 0,
        background: "#2a2f3a",
        color: "white",
        cursor: "pointer",
      }}
    >
      Keluar
    </button>
  );
}
