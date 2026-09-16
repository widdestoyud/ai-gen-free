"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api";

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks?: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        },
      ) => void;
      embed: (
        token: string,
        options: {
          embedId: string;
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        },
      ) => void;
    };
  }
}

export type PaymentMethod = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  clientKey?: string;
  isProduction?: boolean;
  snapUrl?: string;
  channels?: Array<{
    id: string;
    name: string;
    banks?: string[];
    providers?: string[];
  }>;
};

export type PaymentResult = {
  invoiceId: string;
  paymentUrl?: string;
  tokenId?: string;
  expiredAt?: string;
  clientKey?: string;
  snapUrl?: string;
  isProduction?: boolean;
  isExisting?: boolean;
};

export type PaymentStatus = {
  invoiceId: string;
  status: "paid" | "pending" | "failed" | "expired" | string;
  paidAt?: string;
  paymentChannel?: string;
  message?: string;
};

/**
 * Dynamically loads the Midtrans Snap JS library if not already present.
 */
function ensureSnapScriptLoaded(clientKey?: string, snapUrl?: string): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.snap) return Promise.resolve(true);

  const url = snapUrl || "https://app.sandbox.midtrans.com/snap/snap.js";
  const existing = document.querySelector<HTMLScriptElement>(`script[src*="snap.js"]`);
  if (existing) {
    if (window.snap) return Promise.resolve(true);
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      setTimeout(() => resolve(Boolean(window.snap)), 3000);
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = url;
    script.type = "text/javascript";
    if (clientKey) {
      script.setAttribute("data-client-key", clientKey);
    }
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function usePayment() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  /**
   * Get available payment methods
   */
  const getPaymentMethods = useCallback(async (): Promise<PaymentMethod[]> => {
    const result = await requestJson<{ methods?: PaymentMethod[] }>("/api/payment/methods");
    if (!result.ok) {
      return [
        {
          id: "manual",
          name: "Transfer Manual",
          description: "Transfer ke rekening dan unggah bukti",
          enabled: true,
        },
      ];
    }
    return result.data?.methods ?? [];
  }, []);

  /**
   * Initiate payment via Midtrans Snap
   * Returns payment session data (token_id & payment_url)
   */
  const initiatePayment = useCallback(
    async (
      invoiceId: string,
      opts?: {
        customerEmail?: string;
        customerName?: string;
        customerPhone?: string;
      },
    ): Promise<PaymentResult | null> => {
      setLoading(true);
      setError("");
      setPaymentResult(null);

      try {
        const result = await requestJson<PaymentResult>(`/api/invoices/${invoiceId}/pay`, {
          method: "POST",
          body: JSON.stringify(opts ?? {}),
        });

        if (!result.ok) {
          setError(result.message || "Gagal memulai pembayaran");
          return null;
        }

        const data = result.data;
        setPaymentResult(data);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Terjadi kesalahan";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Check payment status
   */
  const checkPaymentStatus = useCallback(
    async (invoiceId: string): Promise<PaymentStatus | null> => {
      try {
        const result = await requestJson<PaymentStatus>(`/api/invoices/${invoiceId}/payment-status`);
        if (!result.ok) {
          return null;
        }
        return result.data;
      } catch {
        return null;
      }
    },
    [],
  );

  /**
   * Redirect to Midtrans payment page (fallback if popup is blocked)
   */
  const redirectToPayment = useCallback((paymentUrl: string) => {
    window.location.href = paymentUrl;
  }, []);

  /**
   * Initiate and open Midtrans Snap Popup/Modal directly on the page
   * Falls back to redirect only if Snap script is unavailable
   */
  const payWithSnap = useCallback(
    async (
      invoiceId: string,
      opts?: {
        customerEmail?: string;
        customerName?: string;
        customerPhone?: string;
        onSuccess?: (result: unknown) => void;
        onPending?: (result: unknown) => void;
        onError?: (result: unknown) => void;
        onClose?: () => void;
      },
    ): Promise<PaymentResult | null> => {
      const result = await initiatePayment(invoiceId, opts);
      if (!result) return null;

      if (result.tokenId) {
        await ensureSnapScriptLoaded(result.clientKey, result.snapUrl);

        if (window.snap?.pay) {
          window.snap.pay(result.tokenId, {
            onSuccess: (res) => {
              opts?.onSuccess?.(res);
              router.refresh();
            },
            onPending: (res) => {
              opts?.onPending?.(res);
              router.refresh();
            },
            onError: (err) => {
              opts?.onError?.(err);
              setError("Pembayaran tidak berhasil diselesaikan.");
              router.refresh();
            },
            onClose: () => {
              opts?.onClose?.();
              router.refresh();
            },
          });
          return result;
        }
      }

      // Fallback redirect if snap popup could not be initialized
      if (result.paymentUrl) {
        redirectToPayment(result.paymentUrl);
      }
      return result;
    },
    [initiatePayment, redirectToPayment, router],
  );

  /**
   * Embed Midtrans Snap inside a DOM container (renders inline, not popup).
   * Use this to render Snap inside a Mantine Modal.
   * Returns the PaymentResult after initiating, caller must provide embedId.
   */
  const embedSnap = useCallback(
    async (
      invoiceId: string,
      embedId: string,
      opts?: {
        customerEmail?: string;
        customerName?: string;
        customerPhone?: string;
        onSuccess?: (result: unknown) => void;
        onPending?: (result: unknown) => void;
        onError?: (result: unknown) => void;
        onClose?: () => void;
      },
    ): Promise<PaymentResult | null> => {
      const result = await initiatePayment(invoiceId, opts);
      if (!result) return null;

      if (result.tokenId) {
        await ensureSnapScriptLoaded(result.clientKey, result.snapUrl);

        if (window.snap?.embed) {
          window.snap.embed(result.tokenId, {
            embedId,
            onSuccess: (res) => {
              opts?.onSuccess?.(res);
              router.refresh();
            },
            onPending: (res) => {
              opts?.onPending?.(res);
              router.refresh();
            },
            onError: (err) => {
              opts?.onError?.(err);
              setError("Pembayaran tidak berhasil diselesaikan.");
              router.refresh();
            },
            onClose: () => {
              opts?.onClose?.();
              router.refresh();
            },
          });
          return result;
        }

        // Fallback to popup if embed is not available
        if (window.snap?.pay) {
          window.snap.pay(result.tokenId, {
            onSuccess: (res) => {
              opts?.onSuccess?.(res);
              router.refresh();
            },
            onPending: (res) => {
              opts?.onPending?.(res);
              router.refresh();
            },
            onError: (err) => {
              opts?.onError?.(err);
              setError("Pembayaran tidak berhasil diselesaikan.");
              router.refresh();
            },
            onClose: () => {
              opts?.onClose?.();
              router.refresh();
            },
          });
          return result;
        }
      }

      setError("Snap pembayaran tidak tersedia. Silakan coba lagi.");
      return result;
    },
    [initiatePayment, router],
  );

  /**
   * Alias for backward compatibility: opens Snap popup modal by default
   */
  const payAndRedirect = payWithSnap;

  /**
   * Poll payment status until completed or timeout
   */
  const pollPaymentStatus = useCallback(
    async (
      invoiceId: string,
      opts?: {
        intervalMs?: number;
        maxAttempts?: number;
        onStatus?: (status: PaymentStatus) => void;
      },
    ): Promise<PaymentStatus | null> => {
      const intervalMs = opts?.intervalMs ?? 3000;
      const maxAttempts = opts?.maxAttempts ?? 60; // 3 minutes default

      for (let i = 0; i < maxAttempts; i++) {
        const status = await checkPaymentStatus(invoiceId);

        if (status) {
          opts?.onStatus?.(status);

          if (status.status === "paid" || status.status === "failed" || status.status === "expired") {
            if (status.status === "paid") {
              router.refresh();
            }
            return status;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }

      return null;
    },
    [checkPaymentStatus, router],
  );

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError("");
  }, []);

  return {
    loading,
    error,
    paymentResult,
    getPaymentMethods,
    initiatePayment,
    checkPaymentStatus,
    redirectToPayment,
    payWithSnap,
    embedSnap,
    payAndRedirect,
    pollPaymentStatus,
    clearError,
  };
}
