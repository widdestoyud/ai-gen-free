"use client";

import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePayment } from "@/hooks/use-payment";
import { requestJson } from "@/lib/api";
import { formatIdr } from "@/lib/format";
import { ErrorAlert } from "./error-alert";
import classes from "./snap-payment-modal.module.css";

const SNAP_EMBED_ID = "snap-midtrans-container";

interface InvoicePaymentInfo {
  id: string;
  uniqueCode: string;
  amountIdr: number;
  points: number;
  status: string;
}

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
  const { embedSnap, checkPaymentStatus, loading, error, clearError } = usePayment();
  const [embedStatus, setEmbedStatus] = useState<"idle" | "loading" | "active" | "done" | "error">("idle");
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [invoiceInfo, setInvoiceInfo] = useState<InvoicePaymentInfo | null>(null);
  const [isCheckingManual, setIsCheckingManual] = useState(false);
  const initiatedRef = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Stop polling helper
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleManualCheck = async () => {
    if (!invoiceId) return;
    setIsCheckingManual(true);
    try {
      const status = await checkPaymentStatus(invoiceId);
      if (status && status.status === "paid") {
        stopPolling();
        setEmbedStatus("done");
        onSuccess?.(status);
      }
    } finally {
      setIsCheckingManual(false);
    }
  };

  useEffect(() => {
    if (!opened || !invoiceId) {
      initiatedRef.current = false;
      setEmbedStatus("idle");
      setPaymentUrl(null);
      setInvoiceInfo(null);
      stopPolling();
      return;
    }

    if (initiatedRef.current) return;
    initiatedRef.current = true;

    setEmbedStatus("loading");
    setPaymentUrl(null);
    clearError();

    // Fetch invoice details for display
    void requestJson<InvoicePaymentInfo>(`/api/invoices/${invoiceId}/payment-info`).then((res) => {
      if (res.ok && res.data) {
        setInvoiceInfo(res.data);
      }
    });

    const timer = setTimeout(() => {
      void embedSnap(invoiceId, SNAP_EMBED_ID, {
        onSuccess: (res) => {
          stopPolling();
          setEmbedStatus("done");
          onSuccess?.(res);
        },
        onPending: (res) => {
          setEmbedStatus("done");
          onPending?.(res);
        },
        onError: (err) => {
          stopPolling();
          setEmbedStatus("error");
          onError?.(err);
        },
        onClose: () => {
          stopPolling();
          setEmbedStatus("done");
          onClose();
        },
      }).then((result) => {
        if (result) {
          if (result.paymentUrl && !result.tokenId) {
            // Xendit or redirect payment gateway: render modal payment selector
            setPaymentUrl(result.paymentUrl);
            setEmbedStatus("active");

            // Start polling payment status in background
            stopPolling();
            pollingRef.current = setInterval(async () => {
              const status = await checkPaymentStatus(invoiceId);
              if (status && status.status === "paid") {
                stopPolling();
                setEmbedStatus("done");
                onSuccess?.(status);
              }
            }, 3000);
          } else {
            // Midtrans Snap embed container
            setEmbedStatus("active");
          }
        } else {
          setEmbedStatus("error");
        }
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, invoiceId]);

  const handleClose = () => {
    stopPolling();
    initiatedRef.current = false;
    setEmbedStatus("idle");
    setPaymentUrl(null);
    setInvoiceInfo(null);
    clearError();
    onClose();
  };

  const codeToDisplay = invoiceInfo?.uniqueCode || invoiceCode || invoiceId;
  const amountToDisplay = invoiceInfo ? formatIdr(invoiceInfo.amountIdr) : null;
  const pointsToDisplay = invoiceInfo?.points ? `+${invoiceInfo.points.toLocaleString()} Sparks` : null;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <Text fw={700} size="md">
            Pilih Metode Pembayaran
          </Text>
          {codeToDisplay && (
            <Badge variant="light" color="blue" size="sm">
              {codeToDisplay}
            </Badge>
          )}
        </Group>
      }
      centered
      size="lg"
      radius="lg"
      closeOnClickOutside={false}
      closeOnEscape={embedStatus !== "loading"}
    >
      {error && <ErrorAlert message={error} />}

      {(embedStatus === "idle" || embedStatus === "loading" || loading) && (
        <div className={classes.loadingContainer}>
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            Menyiapkan metode pembayaran...
          </Text>
        </div>
      )}

      {/* Embedded Native Xendit Payment Selector View */}
      {paymentUrl && embedStatus === "active" && (
        <Stack gap="md">
          {/* Invoice Summary Box */}
          <Paper p="md" withBorder radius="md" style={{ background: "rgba(255, 255, 255, 0.02)" }}>
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed">
                  Total Pembayaran
                </Text>
                <Text size="xl" fw={800} c="blue.4">
                  {amountToDisplay ?? "—"}
                </Text>
              </div>
              {pointsToDisplay && (
                <div style={{ textAlign: "right" }}>
                  <Text size="xs" c="dimmed">
                    Paket Diperoleh
                  </Text>
                  <Text size="md" fw={700} c="green.4">
                    {pointsToDisplay}
                  </Text>
                </div>
              )}
            </Group>
          </Paper>

          {/* Supported Payment Channels Grid */}
          <div>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs">
              Metode Pembayaran yang Tersedia
            </Text>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              {/* QRIS */}
              <div className={classes.methodCard}>
                <Group justify="space-between" mb={6}>
                  <Text size="sm" fw={700}>
                    ⚡ QRIS (Instan)
                  </Text>
                  <Badge size="xs" color="teal" variant="light">
                    Otomatis
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mb="xs">
                  Scan QR via GoPay, OVO, Dana, ShopeePay, BCA QRIS, &amp; Mobile Banking
                </Text>
                <Group gap={4}>
                  <span className={classes.channelTag}>GoPay</span>
                  <span className={classes.channelTag}>ShopeePay</span>
                  <span className={classes.channelTag}>Dana</span>
                  <span className={classes.channelTag}>OVO</span>
                  <span className={classes.channelTag}>QRIS</span>
                </Group>
              </div>

              {/* Virtual Account */}
              <div className={classes.methodCard}>
                <Group justify="space-between" mb={6}>
                  <Text size="sm" fw={700}>
                    🏦 Virtual Account
                  </Text>
                  <Badge size="xs" color="blue" variant="light">
                    24 Jam
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mb="xs">
                  Transfer via Bank VA langsung terverifikasi tanpa upload bukti
                </Text>
                <Group gap={4}>
                  <span className={classes.channelTag}>BCA</span>
                  <span className={classes.channelTag}>Mandiri</span>
                  <span className={classes.channelTag}>BRI</span>
                  <span className={classes.channelTag}>BNI</span>
                  <span className={classes.channelTag}>Permata</span>
                </Group>
              </div>

              {/* E-Wallet */}
              <div className={classes.methodCard}>
                <Group justify="space-between" mb={6}>
                  <Text size="sm" fw={700}>
                    📱 E-Wallet Langsung
                  </Text>
                  <Badge size="xs" color="violet" variant="light">
                    Mudah
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mb="xs">
                  Bayar langsung melalui akun dompet digital pilihan Anda
                </Text>
                <Group gap={4}>
                  <span className={classes.channelTag}>OVO</span>
                  <span className={classes.channelTag}>DANA</span>
                  <span className={classes.channelTag}>LinkAja</span>
                  <span className={classes.channelTag}>AstraPay</span>
                </Group>
              </div>

              {/* Retail Outlets */}
              <div className={classes.methodCard}>
                <Group justify="space-between" mb={6}>
                  <Text size="sm" fw={700}>
                    🏪 Gerai Retail
                  </Text>
                  <Badge size="xs" color="orange" variant="light">
                    Tunai
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mb="xs">
                  Pembayaran tunai di gerai terdekat di seluruh Indonesia
                </Text>
                <Group gap={4}>
                  <span className={classes.channelTag}>Indomaret</span>
                  <span className={classes.channelTag}>Alfamart</span>
                </Group>
              </div>
            </SimpleGrid>
          </div>

          {/* Status Polling Live Bar */}
          <Paper p="xs" px="sm" withBorder radius="md" style={{ background: "rgba(16, 185, 129, 0.05)", borderColor: "rgba(16, 185, 129, 0.2)" }}>
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <div className={classes.pulseDot} />
                <Text size="xs" fw={600} c="green.4">
                  Menunggu Pembayaran
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                Status terupdate otomatis
              </Text>
            </Group>
          </Paper>

          {/* Primary Action Button */}
          <Stack gap="xs" mt="xs">
            <Button
              component="a"
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="gradient"
              gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
              size="lg"
              fullWidth
              fw={700}
            >
              Lanjutkan ke Pembayaran Xendit ↗
            </Button>

            <Group grow gap="xs">
              <Button
                variant="light"
                color="blue"
                size="sm"
                loading={isCheckingManual}
                onClick={handleManualCheck}
              >
                Cek Status Pembayaran
              </Button>
              <Button variant="default" size="sm" onClick={handleClose}>
                Tutup
              </Button>
            </Group>
          </Stack>
        </Stack>
      )}

      {/* Midtrans Snap DOM Container */}
      {!paymentUrl && (
        <div
          id={SNAP_EMBED_ID}
          className={classes.snapContainer}
          style={{ display: embedStatus === "active" ? "block" : "none" }}
        />
      )}

      {embedStatus === "error" && !error && (
        <div className={classes.errorContainer}>
          <Text size="sm" c="red.4">
            Gagal memuat sesi pembayaran. Silakan coba lagi.
          </Text>
          <Stack gap="xs" align="center">
            <Button variant="default" onClick={handleClose}>
              Tutup
            </Button>
          </Stack>
        </div>
      )}

      {embedStatus === "done" && (
        <div className={classes.successContainer}>
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 0 28px rgba(16, 185, 129, 0.4)",
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <Stack gap="xs" align="center">
            <Title order={3} size="h3" c="white">
              Pembayaran Berhasil!
            </Title>
            <Text size="sm" c="dimmed" maw={380}>
              Transaksi Anda telah terverifikasi. Sparks telah ditambahkan ke saldo akun Anda.
            </Text>
          </Stack>

          <Group justify="center" mt="sm">
            <Button
              component={Link}
              href="/app/generate"
              variant="gradient"
              gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
              onClick={handleClose}
            >
              Mulai Buat Konten Sekarang
            </Button>
            <Button variant="default" onClick={handleClose}>
              Tutup
            </Button>
          </Group>
        </div>
      )}
    </Modal>
  );
}
