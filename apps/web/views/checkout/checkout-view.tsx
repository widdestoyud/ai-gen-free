"use client";

import {
  Badge,
  Button,
  FileInput,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { requestJson } from "@/lib/api";
import { formatIdr } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { DEFAULT_PRICING_PLANS, type PricingPlanItem } from "@/lib/pricing-packages";
import { usePayment } from "@/hooks/use-payment";
import { useLogin } from "@/hooks/use-login";
import { useRegister } from "@/hooks/use-register";
import { useForgotPassword } from "@/hooks/use-forgot-password";
import { LoginModal } from "@/views/landing/components/login-modal";
import { RegisterModal } from "@/views/landing/components/register-modal";
import { ForgotPasswordModal } from "@/views/landing/components/forgot-password-modal";
import { OtpModal } from "@/components/otp-modal";
import { SnapPaymentModal } from "@/components/snap-payment-modal";
import { ErrorAlert } from "@/components/error-alert";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  ArrowLeftIcon,
  BankTransferLogo,
  OnlinePaymentLogo,
} from "./checkout-icons";
import classes from "./checkout.module.css";

export type CheckoutMethodId = "online" | "manual";

interface PaymentOption {
  id: CheckoutMethodId;
  label: string;
  isBest?: boolean;
  renderLogo: (active: boolean) => React.ReactNode;
}

export function CheckoutView() {
  const { t } = useI18n("checkout");
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const queryPackageId =
    searchParams.get("packageId") ||
    searchParams.get("id") ||
    searchParams.get("package") ||
    "starter";

  const checkoutUrl = useMemo(() => {
    return `/checkout?packageId=${encodeURIComponent(queryPackageId)}`;
  }, [queryPackageId]);

  const [selectedMethod, setSelectedMethod] = useState<CheckoutMethodId>("online");
  const [email, setEmail] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [snapInvoice, setSnapInvoice] = useState<{ id: string; code: string } | null>(null);

  // Manual payment QRIS & upload proof modal state
  const [manualInvoice, setManualInvoice] = useState<{
    id: string;
    uniqueCode: string;
    amountIdr: number;
    points: number;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { initiatePayment, getPaymentMethods, error: paymentError, clearError: clearPaymentError } = usePayment();

  // Fetch user profile
  const { data: profileData, isLoading: isLoadingProfile, refetch: refetchProfile } = useQuery<{ user?: { email?: string; name?: string } }>({
    queryKey: queryKeys.customerProfile(),
    queryFn: async () => {
      const res = await requestJson<{ user?: { email?: string; name?: string } }>("/api/customer-profile");
      return res.ok && res.data ? res.data : {};
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const isAuthenticated = Boolean(profileData?.user?.email || profileData?.user?.name);

  // Fetch catalog packages
  const { data: catalogPackages, isLoading: isLoadingPackages } = useQuery<PricingPlanItem[]>({
    queryKey: queryKeys.catalogPackages(),
    queryFn: async () => {
      const res = await requestJson<{
        packages?: Array<{ id: string; name: string; amountIdr: number; points: number; description?: string }>;
      }>("/api/catalog/topup");
      if (res.ok && Array.isArray(res.data?.packages) && res.data.packages.length > 0) {
        return res.data.packages.map((pkg, idx) => ({
          id: pkg.id,
          name: pkg.name,
          label: pkg.name,
          price: formatIdr(pkg.amountIdr),
          amountIdr: pkg.amountIdr,
          points: pkg.points,
          description: pkg.description || "Sparks topup",
          popular: idx === 1,
          perks: [],
        }));
      }
      return DEFAULT_PRICING_PLANS;
    },
    staleTime: 5_000,
    refetchOnMount: "always",
  });

  // Selected package from query
  const currentPackage = useMemo(() => {
    const list = catalogPackages && catalogPackages.length > 0 ? catalogPackages : (isLoadingPackages ? [] : DEFAULT_PRICING_PLANS);
    if (list.length === 0) return null;
    const targetId = queryPackageId.trim();
    const lower = targetId.toLowerCase();
    return (
      list.find((p) => p.id === targetId) ||
      list.find((p) => p.id.toLowerCase() === lower) ||
      list.find((p) => p.name.toLowerCase() === lower) ||
      list.find((p) => p.name.toLowerCase().includes(lower)) ||
      list.find((p) => p.id.toLowerCase().includes(lower)) ||
      (lower.includes("pro") && list.find((p) => p.name.toLowerCase().includes("pro"))) ||
      (lower.includes("power") && list.find((p) => p.name.toLowerCase().includes("power"))) ||
      (lower.includes("starter") && list.find((p) => p.name.toLowerCase().includes("starter"))) ||
      list[0]
    );
  }, [catalogPackages, isLoadingPackages, queryPackageId]);

  // Fetch active payment settings from backend
  const { data: paymentConfig } = useQuery({
    queryKey: queryKeys.paymentMethods(),
    queryFn: async () => {
      return await getPaymentMethods();
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const onlineEnabled = paymentConfig ? Boolean(paymentConfig.onlineEnabled) : false;
  const manualEnabled = paymentConfig ? Boolean(paymentConfig.manualEnabled) : true;
  const activeGateway = paymentConfig?.activeOnlineGateway || "online";

  // Build the payment method options based on admin config
  const paymentOptions: PaymentOption[] = useMemo(() => {
    const options: PaymentOption[] = [];

    if (onlineEnabled) {
      let onlineLabel = "Pembayaran Online";
      if (activeGateway === "dana") {
        onlineLabel = "DANA";
      } else if (activeGateway === "doku") {
        onlineLabel = "Pembayaran Online (DOKU)";
      } else if (activeGateway === "midtrans") {
        onlineLabel = "Pembayaran Online (Midtrans)";
      } else if (activeGateway === "xendit") {
        onlineLabel = "Pembayaran Online (Xendit)";
      }

      options.push({
        id: "online",
        label: onlineLabel,
        renderLogo: (active) => (
          <OnlinePaymentLogo active={active} gateway={activeGateway} />
        ),
      });
    }

    if (manualEnabled) {
      options.push({
        id: "manual",
        label: "Transfer Manual",
        renderLogo: (active) => <BankTransferLogo active={active} />,
      });
    }

    return options;
  }, [onlineEnabled, manualEnabled, activeGateway]);

  // Sync default selected method if current selection is disabled
  useEffect(() => {
    if (!onlineEnabled && manualEnabled && selectedMethod === "online") {
      setSelectedMethod("manual");
    } else if (onlineEnabled && !manualEnabled && selectedMethod === "manual") {
      setSelectedMethod("online");
    }
  }, [onlineEnabled, manualEnabled, selectedMethod]);

  useEffect(() => {
    if (profileData?.user?.email) {
      setEmail(profileData.user.email);
    }
  }, [profileData?.user?.email]);

  // Flag to auto-proceed payment right after user successfully authenticates
  const pendingPayRef = useRef(false);

  // Core checkout & payment execution
  const proceedPayment = useCallback(
    async (overrideEmail?: string) => {
      setError("");
      clearPaymentError();
      setBusy(true);

      try {
        // 1. Create Invoice
        const targetPackageId = currentPackage?.id || queryPackageId;
        const invoiceRes = await requestJson<{ id: string; uniqueCode: string }>("/api/invoices", {
          method: "POST",
          body: JSON.stringify({ packageId: targetPackageId, paymentMethod: selectedMethod }),
        });

        if (!invoiceRes.ok) {
          setBusy(false);
          if (
            invoiceRes.status === 401 ||
            invoiceRes.code === "UNAUTHENTICATED" ||
            invoiceRes.code === "UNAUTHORIZED" ||
            invoiceRes.message?.toLowerCase().includes("masuk") ||
            invoiceRes.message?.toLowerCase().includes("sesi")
          ) {
            setError("");
            clearPaymentError();
            pendingPayRef.current = true;
            login.openLogin();
            return;
          }
          setError(invoiceRes.message || "Gagal membuat tagihan pesanan.");
          return;
        }

        if (!invoiceRes.data?.id) {
          setBusy(false);
          setError("Gagal membuat tagihan pesanan.");
          return;
        }

        const invoiceId = invoiceRes.data.id;
        const uniqueCode = invoiceRes.data.uniqueCode;

        // Invalidate invoice & wallet queries
        void queryClient.invalidateQueries({ queryKey: queryKeys.orderInvoices() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.billingLedger() });

        // 2. Handle Manual Transfer Payment (Buka Modal QRIS)
        if (selectedMethod === "manual") {
          setManualInvoice({
            id: invoiceId,
            uniqueCode,
            amountIdr: currentPackage?.amountIdr ?? 0,
            points: currentPackage?.points ?? 0,
          });
          setBusy(false);
          return;
        }

        // 3. Handle Online Payment (DOKU / DANA / Xendit / Midtrans)
        const customerEmail = overrideEmail || email || profileData?.user?.email || "";
        const payRes = await initiatePayment(invoiceId, {
          customerEmail: customerEmail || undefined,
        });

        if (!payRes) {
          setBusy(false);
          if (
            paymentError &&
            (paymentError.toLowerCase().includes("masuk") ||
              paymentError.toLowerCase().includes("sesi") ||
              paymentError.toLowerCase().includes("unauthenticated"))
          ) {
            setError("");
            clearPaymentError();
            pendingPayRef.current = true;
            login.openLogin();
            return;
          }
          setError("Gagal menginisiasi pembayaran online.");
          return;
        }

        // If redirect URL is provided (e.g. DOKU / DANA / Xendit / Payment link)
        if (
          payRes.paymentUrl &&
          (activeGateway === "dana" ||
            activeGateway === "doku" ||
            payRes.frontendConfig?.meta?.flowType === "redirect" ||
            payRes.frontendConfig?.driver === "doku" ||
            payRes.frontendConfig?.driver === "xendit" ||
            payRes.frontendConfig?.driver === "dana")
        ) {
          window.location.replace(payRes.paymentUrl);
          return;
        }

        // If Midtrans Snap token exists, open embedded Snap popup
        if (payRes.tokenId || payRes.paymentUrl) {
          setSnapInvoice({ id: invoiceId, code: uniqueCode });
          setBusy(false);
          return;
        }

        setBusy(false);
      } catch (err) {
        setBusy(false);
        setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses pembayaran.");
      }
    },
    [
      currentPackage,
      queryPackageId,
      selectedMethod,
      queryClient,
      email,
      profileData?.user?.email,
      initiatePayment,
      activeGateway,
      paymentError,
      clearPaymentError,
    ],
  );

  // Authentication success callback (from email/pass or OTP)
  const handleAuthSuccess = useCallback(async () => {
    const refetched = await refetchProfile();
    const activeEmail = refetched.data?.user?.email;
    if (activeEmail) {
      setEmail(activeEmail);
    }
    if (pendingPayRef.current) {
      pendingPayRef.current = false;
      void proceedPayment(activeEmail);
    }
  }, [refetchProfile, proceedPayment]);

  const login = useLogin(checkoutUrl, {
    onSuccess: handleAuthSuccess,
  });
  const register = useRegister();
  const forgotPassword = useForgotPassword();

  const handleOpenRegisterFromLogin = useCallback(() => {
    const currentEmail = login.email;
    login.closeLogin();
    register.openRegister();
    if (currentEmail) {
      register.setEmail(currentEmail);
    }
  }, [login, register]);

  const handleOpenLoginFromRegister = useCallback(() => {
    const currentEmail = register.email;
    register.closeRegister();
    login.openLogin();
    if (currentEmail) {
      login.setEmail(currentEmail);
    }
  }, [login, register]);

  const handleOpenForgotPassword = useCallback(() => {
    login.closeLogin();
    forgotPassword.openForgotPassword(login.email);
  }, [login, forgotPassword]);

  const handleBackToLoginFromForgot = useCallback(() => {
    forgotPassword.closeForgotPassword();
    login.openLogin();
    if (forgotPassword.email) {
      login.setEmail(forgotPassword.email);
    }
  }, [login, forgotPassword]);

  const handleClose = () => {
    if (isAuthenticated) {
      router.push("/app/order");
    } else {
      router.push("/");
    }
  };

  const handlePay = useCallback(async () => {
    if (!isAuthenticated || !profileData?.user?.email) {
      setError("");
      clearPaymentError();
      pendingPayRef.current = true;
      login.openLogin();
      return;
    }

    await proceedPayment();
  }, [isAuthenticated, profileData?.user?.email, clearPaymentError, login, proceedPayment]);

  const handleUploadProof = async () => {
    if (!manualInvoice || !selectedFile) return;
    setError("");
    setBusy(true);
    const form = new FormData();
    form.set("file", selectedFile);
    const result = await requestJson(`/api/invoices/${manualInvoice.id}/proof`, {
      method: "POST",
      body: form,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message || "Gagal mengunggah bukti pembayaran.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.orderInvoices() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.billingLedger() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
    setManualInvoice(null);
    setSelectedFile(null);
    router.push("/app/order");
  };

  const selectedMethodObj =
    paymentOptions.find((o) => o.id === selectedMethod) ||
    paymentOptions[0] || {
      id: "online",
      label: "Pembayaran Online",
      renderLogo: () => null,
    };

  return (
    <div className={classes.pageWrapper}>
      <div className={classes.checkoutContainer}>
        {/* TOP BAR: Back button & Language Switcher */}
        <div className={classes.topBar} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            leftSection={<ArrowLeftIcon size={16} />}
            onClick={handleClose}
            className={classes.backButton}
          >
            {isAuthenticated ? t("back_to_order") : t("back_to_home")}
          </Button>
          <LanguageSwitcher />
        </div>

        <div className={classes.checkoutCard}>
          {/* LEFT PANEL: Payment Method */}
          <div className={classes.leftPanel}>
            <div className={classes.panelHeader}>
              <span>{t("payment_method_panel")}</span>
            </div>

            {/* Payment Method Cards */}
            <div className={classes.paymentMethodsGrid}>
              {paymentOptions.map((opt) => {
                const isActive = selectedMethod === opt.id;
                return (
                  <div
                    key={opt.id}
                    className={`${classes.paymentCard} ${isActive ? classes.paymentCardActive : ""}`}
                    onClick={() => setSelectedMethod(opt.id)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                  >
                    <div className={classes.cardLogoRow}>{opt.renderLogo(isActive)}</div>
                  </div>
                );
              })}
            </div>

            {/* Status / Notice info */}
            <div className={classes.manualInfoBox}>
              <Text size="xs" c="blue.2" fw={500}>
                {t("instant_notice")}
              </Text>
            </div>
          </div>

          {/* RIGHT PANEL: Order Details */}
          <div className={classes.rightPanel}>
            <div className={classes.panelHeader}>
              <span>{t("order_details_panel")}</span>
            </div>

            {error ? <ErrorAlert message={error} /> : null}
            {paymentError ? <ErrorAlert message={paymentError} /> : null}

            {/* Order Details List */}
            <div className={classes.orderDetailsList}>
              <div className={classes.orderDetailRow}>
                <span>{t("product_label")}</span>
                <span className={classes.orderDetailValue}>
                  {currentPackage ? currentPackage.name : (isLoadingPackages ? t("loading_package") : t("default_package_name"))}
                </span>
              </div>

              <div className={classes.orderDetailRow}>
                <span>{t("item_label")}</span>
                <span className={classes.orderDetailValue}>
                  {currentPackage ? t("sparks_unit", { points: currentPackage.points.toLocaleString("id-ID") }) : "—"}
                </span>
              </div>

              <div className={classes.orderDetailRow}>
                <span>{t("price_label")}</span>
                <span className={classes.orderDetailValue}>
                  {currentPackage ? formatIdr(currentPackage.amountIdr) : "—"}
                </span>
              </div>

              <div className={classes.orderDetailRow}>
                <span>{t("payment_method_label")}</span>
                <span className={classes.orderDetailValue}>{selectedMethodObj.label}</span>
              </div>
            </div>

            <div className={classes.divider} />

            {/* Total Payment Row */}
            <div className={classes.totalRow}>
              <span className={classes.totalLabel}>{t("total_payment_label")}</span>
              <div className={classes.totalAmountBox}>
                <span className={classes.totalMethod}>{selectedMethodObj.label.split(" ")[0]}</span>
                <span className={classes.totalPrice}>
                  {currentPackage ? formatIdr(currentPackage.amountIdr) : "—"}
                </span>
              </div>
            </div>

            {/* Bayar Action Button */}
            <Button
              fullWidth
              size="md"
              variant="gradient"
              gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
              onClick={() => void handlePay()}
              loading={busy || isLoadingPackages}
              disabled={busy || isLoadingPackages || !currentPackage}
              fw={700}
              radius="md"
              mt="xs"
            >
              {t("btn_pay")}
            </Button>
          </div>
        </div>
      </div>

      {/* Snap Midtrans Modal */}
      {snapInvoice && (
        <SnapPaymentModal
          opened={Boolean(snapInvoice)}
          onClose={() => setSnapInvoice(null)}
          invoiceId={snapInvoice.id}
          invoiceCode={snapInvoice.code}
          onSuccess={() => {
            setSnapInvoice(null);
            router.push("/app/order/success");
          }}
          onPending={() => {
            setSnapInvoice(null);
            router.push("/app/order");
          }}
          onError={() => {
            setSnapInvoice(null);
            router.push("/app/order/failed");
          }}
        />
      )}

      {/* Modal QRIS & Upload Bukti Transfer Manual */}
      <Modal
        opened={Boolean(manualInvoice)}
        onClose={() => {
          if (!busy) {
            setManualInvoice(null);
            setSelectedFile(null);
          }
        }}
        title={
          <Group gap="xs">
            <Text fw={700} size="md" c="white">
              {t("manual_qris_title")}
            </Text>
            {manualInvoice?.uniqueCode && (
              <Badge variant="light" color="blue" size="sm">
                {manualInvoice.uniqueCode}
              </Badge>
            )}
          </Group>
        }
        centered
        size="lg"
        radius="lg"
        padding="lg"
        styles={{
          content: { background: "#081424", border: "1px solid rgba(255, 255, 255, 0.1)" },
          header: { background: "#081424" },
        }}
      >
        <Stack gap="md">
          <div
            style={{
              background: "rgba(14, 165, 233, 0.08)",
              border: "1px solid rgba(14, 165, 233, 0.2)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed">
                  {t("total_bill")}
                </Text>
                <Text size="xl" fw={800} c="blue.4">
                  {manualInvoice ? formatIdr(manualInvoice.amountIdr) : "—"}
                </Text>
              </div>
              <div style={{ textAlign: "right" }}>
                <Text size="xs" c="dimmed">
                  {t("sparks_earned")}
                </Text>
                <Text size="md" fw={700} c="green.4">
                  +{manualInvoice?.points?.toLocaleString()} Sparks
                </Text>
              </div>
            </Group>
          </div>

          {/* QRIS Card Section */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "#ffffff",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Text size="xs" fw={700} c="dark.7" mb={6} style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
              {t("scan_qris")}
            </Text>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/qris-payment.png"
              alt="QRIS Pembayaran Satulabs"
              style={{ maxWidth: 220, width: "100%", height: "auto", borderRadius: 8 }}
            />
            <Group gap="xs" mt={10} justify="center">
              <Badge color="blue" variant="filled" size="sm">
                Merchant: WAY2ND, GAMING
              </Badge>
              <Badge color="gray" variant="outline" size="sm">
                NMID: ID1026482092164
              </Badge>
            </Group>
          </div>

          <FileInput
            label={<Text size="xs" fw={600} c="gray.3">{t("upload_proof_label")}</Text>}
            placeholder={t("upload_proof_placeholder")}
            accept="image/*"
            value={selectedFile}
            onChange={setSelectedFile}
            disabled={busy}
          />

          <Button
            onClick={() => void handleUploadProof()}
            disabled={!selectedFile || busy}
            loading={busy}
            fullWidth
            color="blue"
            size="md"
          >
            {t("btn_submit_proof")}
          </Button>
        </Stack>
      </Modal>

      {/* Auth Modals for unauthenticated checkout */}
      <LoginModal
        opened={login.loginOpened}
        onClose={login.closeLogin}
        onForgotPassword={handleOpenForgotPassword}
        onRegister={handleOpenRegisterFromLogin}
        callbackUrl={checkoutUrl}
        email={login.email}
        password={login.password}
        onEmailChange={login.setEmail}
        onPasswordChange={login.setPassword}
        error={login.otpModalOpened ? null : login.error}
        errorCode={login.otpModalOpened ? null : login.errorCode}
        transactionId={login.otpModalOpened ? null : login.transactionId}
        pending={login.pending && login.loginOpened}
        onSubmit={login.submitLogin}
      />

      <RegisterModal
        opened={register.opened}
        onClose={register.closeRegister}
        onLogin={handleOpenLoginFromRegister}
        callbackUrl={checkoutUrl}
        email={register.email}
        password={register.password}
        onEmailChange={register.setEmail}
        onPasswordChange={register.setPassword}
        termsAccepted={register.termsAccepted}
        onTermsAcceptedChange={register.setTermsAccepted}
        success={register.success}
        error={register.error}
        errorCode={register.errorCode}
        transactionId={register.transactionId}
        pending={register.pending}
        onSubmit={register.submitRegister}
      />

      <ForgotPasswordModal
        opened={forgotPassword.opened}
        onClose={forgotPassword.closeForgotPassword}
        onBackToLogin={handleBackToLoginFromForgot}
        email={forgotPassword.email}
        onEmailChange={forgotPassword.setEmail}
        success={forgotPassword.success}
        error={forgotPassword.error}
        errorCode={forgotPassword.errorCode}
        transactionId={forgotPassword.transactionId}
        pending={forgotPassword.pending}
        onSubmit={forgotPassword.submitForgotPassword}
      />

      <OtpModal
        opened={login.otpModalOpened}
        onClose={login.closeOtpModal}
        email={login.email}
        code={login.code}
        onCodeChange={login.setCode}
        error={login.error}
        errorCode={login.errorCode}
        transactionId={login.transactionId}
        pending={login.pending && login.otpModalOpened}
        onSubmit={login.verifyCode}
        onResendOtp={login.resendOtp}
        resendPending={login.resendPending}
        resendCooldown={login.resendCooldown}
        resendSuccessMessage={login.resendSuccessMessage}
      />
    </div>
  );
}
