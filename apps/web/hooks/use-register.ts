"use client";

import { FormEvent, useState } from "react";
import { requestJson } from "@/lib/api";

export function useRegister() {
  const [opened, setOpened] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [pending, setPending] = useState(false);

  function openRegister() {
    setError("");
    setErrorCode("");
    setTransactionId("");
    setSuccess("");
    setOpened(true);
  }

  function closeRegister() {
    setOpened(false);
    setPassword("");
  }

  async function submitRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    setErrorCode("");
    setTransactionId("");
    setSuccess("");
    setPending(true);

    const result = await requestJson<{ ok?: boolean; message?: string }>("/api/register", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    setPending(false);

    if (!result.ok) {
      setError(result.message);
      setErrorCode(result.code ?? "");
      setTransactionId(result.transaction_id ?? "");
      return;
    }

    setSuccess(result.data.message ?? "Pendaftaran berhasil. Silakan verifikasi email Anda.");
    setPassword("");
  }

  return {
    opened,
    openRegister,
    closeRegister,
    email,
    setEmail,
    password,
    setPassword,
    success,
    error,
    errorCode,
    transactionId,
    pending,
    submitRegister,
  };
}
