"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api";

export function useAdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [otpModalOpened, setOtpModalOpened] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [pending, setPending] = useState(false);

  function resetErrors() {
    setError("");
    setErrorCode("");
    setTransactionId("");
  }

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    resetErrors();
    setPending(true);

    const result = await requestJson("/api/admin/auth/otp/request", {
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

    setOtpModalOpened(true);
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    resetErrors();
    setPending(true);

    const result = await requestJson<{ ok: boolean }>("/api/admin/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
    });

    setPending(false);

    if (!result.ok) {
      setError(result.message);
      setErrorCode(result.code ?? "A002");
      setTransactionId(result.transaction_id ?? "");
      return;
    }

    setOtpModalOpened(false);
    router.push("/admin");
    router.refresh();
  }

  function closeOtpModal() {
    setOtpModalOpened(false);
    setCode("");
    resetErrors();
  }

  return {
    email,
    setEmail,
    code,
    setCode,
    otpModalOpened,
    closeOtpModal,
    error,
    errorCode,
    transactionId,
    pending,
    requestCode,
    verifyCode,
  };
}
