"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api";

export function useLogin() {
  const router = useRouter();
  const [loginOpened, setLoginOpened] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  function openLogin() {
    resetErrors();
    setLoginOpened(true);
  }

  function closeLogin() {
    setLoginOpened(false);
    setPassword("");
    resetErrors();
  }

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    resetErrors();
    setPending(true);

    const result = await requestJson<{ ok?: boolean; requiresOtp?: boolean; message?: string }>(
      "/api/login",
      {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      },
    );

    setPending(false);

    if (!result.ok) {
      setError(result.message);
      setErrorCode(result.code ?? "");
      setTransactionId(result.transaction_id ?? "");
      return;
    }

    if (result.data.requiresOtp) {
      setLoginOpened(false);
      setOtpModalOpened(true);
      return;
    }

    setLoginOpened(false);
    router.push("/app/generate");
    router.refresh();
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    resetErrors();
    setPending(true);

    const result = await requestJson<{ ok: boolean }>("/api/otp-validation", {
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
    setPassword("");
    router.push("/app/generate");
    router.refresh();
  }

  function closeOtpModal() {
    setOtpModalOpened(false);
    setCode("");
    resetErrors();
  }

  return {
    loginOpened,
    openLogin,
    closeLogin,
    email,
    setEmail,
    password,
    setPassword,
    code,
    setCode,
    otpModalOpened,
    closeOtpModal,
    error,
    errorCode,
    transactionId,
    pending,
    submitLogin,
    verifyCode,
  };
}
