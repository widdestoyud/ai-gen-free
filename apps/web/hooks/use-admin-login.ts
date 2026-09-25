"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api";
import { hashPasswordClient } from "@/lib/crypto";

export function useAdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [pending, setPending] = useState(false);

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setErrorCode("");
    setTransactionId("");
    setPending(true);

    const passwordHash = await hashPasswordClient(password);
    const result = await requestJson<{ ok?: boolean }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username: username.trim(), password: passwordHash }),
    });

    setPending(false);

    if (!result.ok) {
      setError(result.message);
      setErrorCode(result.code ?? "");
      setTransactionId(result.transaction_id ?? "");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return {
    username,
    setUsername,
    password,
    setPassword,
    error,
    errorCode,
    transactionId,
    pending,
    submitLogin,
  };
}
