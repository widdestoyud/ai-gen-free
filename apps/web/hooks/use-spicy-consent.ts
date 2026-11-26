"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { requestJson } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { queryKeys } from "@/lib/query-keys";
import { resolveSpicyGate } from "@/lib/template-apply";

export interface UseSpicyConsentOptions {
  initialEnabled: boolean;
  initialHasDob: boolean;
}

export interface UseSpicyConsentResult {
  enabled: boolean;
  hasDob: boolean;
  request: () => boolean;
  modalOpened: boolean;
  confirm: () => Promise<boolean>;
  close: () => void;
  saving: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook pengelola persetujuan Spicy Mode (18+) di studio generate:
 * memeriksa status aktif & keberadaan tanggal lahir, membuka modal konfirmasi,
 * serta mengirim PATCH /api/customer/profile dengan invalidasi cache query terkait.
 */
export function useSpicyConsent({
  initialEnabled,
  initialHasDob,
}: UseSpicyConsentOptions): UseSpicyConsentResult {
  const { t } = useI18n("generate");
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState(initialEnabled);
  const [hasDob, setHasDob] = useState(initialHasDob);
  const [modalOpened, setModalOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled]);

  useEffect(() => {
    setHasDob(initialHasDob);
  }, [initialHasDob]);

  function request(): boolean {
    const decision = resolveSpicyGate(enabled, hasDob);
    if (decision === "allow") {
      setError(null);
      return true;
    }
    if (decision === "need_dob") {
      setError(t("templates.spicy_need_dob"));
      return false;
    }
    setError(null);
    setModalOpened(true);
    return false;
  }

  async function confirm(): Promise<boolean> {
    setSaving(true);
    setError(null);
    const res = await requestJson<{
      ok?: boolean;
      user?: { spicyModeEnabled?: boolean; spicyModeAcceptedAt?: string | null };
      message?: string;
    }>("/api/customer/profile", {
      method: "PATCH",
      body: JSON.stringify({ spicyModeEnabled: true }),
    });
    setSaving(false);

    if (!res.ok) {
      setError(res.message);
      return false;
    }

    setEnabled(true);
    setModalOpened(false);
    queryClient.setQueryData(
      queryKeys.userStatus(),
      (old: Record<string, unknown> | null | undefined) =>
        old
          ? {
              ...old,
              spicyModeEnabled: true,
              spicyModeAcceptedAt:
                res.data?.user?.spicyModeAcceptedAt ?? new Date().toISOString(),
            }
          : old,
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.userStatus() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.customerProfile() });
    return true;
  }

  function close(): void {
    if (saving) return;
    setModalOpened(false);
    setError(null);
  }

  function clearError(): void {
    setError(null);
  }

  return {
    enabled,
    hasDob,
    request,
    modalOpened,
    confirm,
    close,
    saving,
    error,
    clearError,
  };
}
