"use client";

import { Button, Loader, Modal, Stack, Text } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { usePayment } from "@/hooks/use-payment";
import { ErrorAlert } from "./error-alert";
import classes from "./snap-payment-modal.module.css";

const SNAP_EMBED_ID = "snap-midtrans-container";

export function SnapPaymentModal({
  opened,
  onClose,
  invoiceId,
  invoiceCode,
  onSuccess,
  onPending,
  onError,
}: {
  opened: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceCode?: string;
  onSuccess?: (result: unknown) => void;
  onPending?: (result: unknown) => void;
  onError?: (result: unknown) => void;
}) {
  const { embedSnap, loading, error, clearError } = usePayment();
  const [embedStatus, setEmbedStatus] = useState<"idle" | "loading" | "active" | "done" | "error">(
    "idle",
  );
  const initiatedRef = useRef(false);

  useEffect(() => {
    if (!opened || !invoiceId) {
      // Reset state when modal is closed
      initiatedRef.current = false;
      setEmbedStatus("idle");
      return;
    }

    // Avoid re-initiating if already started
    if (initiatedRef.current) return;
    initiatedRef.current = true;

    setEmbedStatus("loading");
    clearError();

    // Small delay to ensure the DOM container is rendered before embed
    const timer = setTimeout(() => {
      void embedSnap(invoiceId, SNAP_EMBED_ID, {
        onSuccess: (res) => {
          setEmbedStatus("done");
          onSuccess?.(res);
        },
        onPending: (res) => {
          setEmbedStatus("done");
          onPending?.(res);
        },
        onError: (err) => {
          setEmbedStatus("error");
          onError?.(err);
        },
        onClose: () => {
          setEmbedStatus("done");
          onClose();
        },
      }).then((result) => {
        if (result) {
          setEmbedStatus("active");
        } else {
          setEmbedStatus("error");
        }
      });
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, invoiceId]);

  const handleClose = () => {
    initiatedRef.current = false;
    setEmbedStatus("idle");
    clearError();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={`Pembayaran${invoiceCode ? `: ${invoiceCode}` : ""}`}
      centered
      size="lg"
      closeOnClickOutside={false}
      closeOnEscape={embedStatus !== "loading"}
    >
      {error && <ErrorAlert message={error} />}

      {(embedStatus === "idle" || embedStatus === "loading" || loading) && (
        <div className={classes.loadingContainer}>
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            Memuat halaman pembayaran...
          </Text>
        </div>
      )}

      <div
        id={SNAP_EMBED_ID}
        className={classes.snapContainer}
      />

      {embedStatus === "error" && !error && (
        <div className={classes.errorContainer}>
          <Text size="sm" c="red">
            Gagal memuat halaman pembayaran. Silakan coba lagi.
          </Text>
          <Stack gap="xs" align="center">
            <Button variant="filled" onClick={handleClose}>
              Tutup
            </Button>
          </Stack>
        </div>
      )}

      {embedStatus === "done" && (
        <div className={classes.errorContainer}>
          <Text size="sm" c="teal" fw={500}>
            Proses pembayaran selesai.
          </Text>
          <Button variant="filled" onClick={handleClose}>
            Tutup
          </Button>
        </div>
      )}
    </Modal>
  );
}
