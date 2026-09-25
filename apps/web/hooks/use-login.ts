"use client";

import { FormEvent, useEffect, useState } from "react";
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
  const [resendPending, setResendPending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccessMessage, setResendSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  function resetErrors() {
    setError("");
    setErrorCode("");
    setTransactionId("");
    setResendSuccessMessage(null);
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
      setResendCooldown(60); // Set 60s cooldown awal
      return;
    }

    setLoginOpened(false);
    router.push("/app/generate");
    router.refresh();
  }

  async function resendOtp() {
    if (resendCooldown > 0 || resendPending) return;
    resetErrors();
    setResendPending(true);

    const result = await requestJson<{ ok?: boolean; message?: string }>("/api/auth/otp", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    setResendPending(false);

    if (!result.ok) {
      setError(result.message);
      setErrorCode(result.code ?? "A008");
      setTransactionId(result.transaction_id ?? "");
      return;
    }

    setResendSuccessMessage("Kode OTP baru telah dikirimkan ke email Anda.");
    setResendCooldown(60);
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
    resendOtp,
    resendPending,
    resendCooldown,
    resendSuccessMessage,
  };
}
