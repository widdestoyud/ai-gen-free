"use client";

import { FormEvent, useEffect, useState } from "react";
import { requestJson } from "@/lib/api";

export function useResetPassword(token: string) {
  const hasToken = token.length > 0;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tokenValid, setTokenValid] = useState(!hasToken);
  const [checking, setChecking] = useState(hasToken);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!hasToken) return;
    let cancelled = false;
    (async () => {
      const result = await requestJson<{ ok?: boolean; message?: string }>(
        "/api/reset-password-validation",
        {
          method: "POST",
          body: JSON.stringify({ token }),
        },
      );
      if (cancelled) return;
      setChecking(false);
      if (!result.ok) {
        setTokenValid(false);
        setError(result.message);
        setErrorCode(result.code ?? "A023");
        setTransactionId(result.transaction_id ?? "");
        return;
      }
      setTokenValid(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasToken, token]);

  async function requestReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
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
    setSuccess(result.data.message ?? "Tautan reset telah dikirim ke email Anda.");
  }

  async function confirmReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setPending(true);
    const result = await requestJson<{ ok?: boolean; message?: string }>("/api/reset-password-confirm", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setErrorCode(result.code ?? "");
      setTransactionId(result.transaction_id ?? "");
      return;
    }
    setSuccess(result.data.message ?? "Kata sandi berhasil diubah.");
    setPassword("");
  }

  return {
    hasToken,
    tokenValid,
    checking,
    email,
    setEmail,
    password,
    setPassword,
    success,
    error,
    errorCode,
    transactionId,
    pending,
    requestReset,
    confirmReset,
  };
}
