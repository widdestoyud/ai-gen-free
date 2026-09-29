"use client";

import { FormEvent, useState } from "react";
import { requestJson } from "@/lib/api";

export function useForgotPassword() {
  const [opened, setOpened] = useState(false);
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function resetState() {
    setError(null);
    setErrorCode(null);
    setTransactionId(null);
    setSuccess(null);
  }

  function openForgotPassword(initialEmail?: string) {
    resetState();
    if (initialEmail !== undefined) {
      setEmail(initialEmail);
    }
    setOpened(true);
  }

  function closeForgotPassword() {
    setOpened(false);
    resetState();
  }

  async function submitForgotPassword(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    resetState();

    if (!email.trim()) {
      setError("Email wajib diisi");
      return;
    }

    setPending(true);
    const result = await requestJson<{ ok?: boolean; message?: string }>("/api/reset-password", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      setErrorCode(result.code ?? "");
      setTransactionId(result.transaction_id ?? "");
      return;
    }

    setSuccess(result.data.message ?? "Tautan reset kata sandi telah dikirim ke email Anda.");
  }

  return {
    opened,
    email,
    setEmail,
    success,
    error,
    errorCode,
    transactionId,
    pending,
    openForgotPassword,
    closeForgotPassword,
    submitForgotPassword,
    resetState,
  };
}
