"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/api";

export function useEmailValidation(token: string) {
  const [status, setStatus] = useState<"idle" | "pending" | "ok" | "error">(token ? "pending" : "idle");
  const [message, setMessage] = useState(token ? "" : "Tautan verifikasi tidak lengkap.");
  const [errorCode, setErrorCode] = useState(token ? "" : "A015");
  const [transactionId, setTransactionId] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const result = await requestJson<{ ok?: boolean; message?: string }>("/api/email-validation", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      if (cancelled) return;
      if (!result.ok) {
        setStatus("error");
        setMessage(result.message);
        setErrorCode(result.code ?? "A015");
        setTransactionId(result.transaction_id ?? "");
        return;
      }
      setStatus("ok");
      setMessage(result.data.message ?? "Email berhasil diverifikasi.");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { status, message, errorCode, transactionId };
}
