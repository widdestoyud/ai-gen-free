/**
 * Payment Routes - Midtrans Payment Gateway
 * Endpoints untuk initiate payment, webhook, dan check status
 */

import type { FastifyInstance } from "fastify";
import { ErrorCodes, type PaymentGatewayPort, type PaymentGatewayRegistry, type GatewayFrontendConfig, type PaymentGatewayDriver } from "@ai-gen-free/core";
import { AuthError, userFromCookie } from "../auth/service.js";
import {
  initiatePayment,
  processPaymentNotification,
  checkPaymentStatus,
  getInvoiceWithPaymentInfo,
  type PaymentServiceDeps,
} from "../wallet/payment.js";

function sendError(reply: { status: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof AuthError) {
    return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
  }
  throw err;
}

async function requireUser(
  req: { cookies: Record<string, string | undefined>; headers: Record<string, unknown> },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
) {
  const token =
    (typeof req.cookies?.sid === "string" && req.cookies.sid.trim().length > 0 ? req.cookies.sid.trim() : undefined) ??
    (typeof req.cookies?.sid_admin === "string" && req.cookies.sid_admin.trim().length > 0 ? req.cookies.sid_admin.trim() : undefined) ??
    (typeof req.headers["x-session-token"] === "string" && (req.headers["x-session-token"] as string).trim().length > 0
      ? (req.headers["x-session-token"] as string).trim()
      : undefined) ??
    (typeof req.headers["authorization"] === "string" && (req.headers["authorization"] as string).toLowerCase().startsWith("bearer ")
      ? (req.headers["authorization"] as string).slice(7).trim()
      : undefined);

  let session = await userFromCookie(token, "user");
  if (!session) {
    session = await userFromCookie(token, "admin");
  }
  if (!session) {
    reply.status(401).send({ error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk" } });
    return null;
  }
  return session;
}

async function requireAdmin(
  req: { cookies: Record<string, string | undefined>; headers: Record<string, unknown> },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
) {
  const token =
    (typeof req.cookies?.sid_admin === "string" && req.cookies.sid_admin.trim().length > 0 ? req.cookies.sid_admin.trim() : undefined) ??
    (typeof req.cookies?.sid === "string" && req.cookies.sid.trim().length > 0 ? req.cookies.sid.trim() : undefined) ??
    (typeof req.headers["x-admin-token"] === "string" && (req.headers["x-admin-token"] as string).trim().length > 0
      ? (req.headers["x-admin-token"] as string).trim()
      : undefined) ??
    (typeof req.headers["x-session-token"] === "string" && (req.headers["x-session-token"] as string).trim().length > 0
      ? (req.headers["x-session-token"] as string).trim()
      : undefined) ??
    (typeof req.headers["authorization"] === "string" && (req.headers["authorization"] as string).toLowerCase().startsWith("bearer ")
      ? (req.headers["authorization"] as string).slice(7).trim()
      : undefined);

  let session = await userFromCookie(token, "admin");
  if (!session) {
    session = await userFromCookie(token, "user");
  }

  if (!session || session.user.role !== "admin") {
    reply.status(401).send({
      error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk sebagai admin" },
    });
    return null;
  }
  return session;
}

export interface PaymentRouteDeps {
  registry: PaymentGatewayRegistry;
  callbackBaseUrl: string;
  paymentDueMinutes?: number;
}

export async function registerPaymentRoutes(app: FastifyInstance, deps: PaymentRouteDeps) {
  // Helper to check if payment gateway is configured
  function requirePaymentGateway(driver?: PaymentGatewayDriver): PaymentServiceDeps {
    const gateway = driver ? deps.registry.get(driver) : deps.registry.getDefault();
    if (!gateway) {
      throw new AuthError(
        ErrorCodes.PAYMENT_GATEWAY_ERROR,
        "Payment gateway tidak dikonfigurasi. Gunakan metode pembayaran manual.",
      );
    }
    const driverKey = driver ?? gateway.provider;
    return {
      paymentGateway: gateway,
      callbackBaseUrl: deps.callbackBaseUrl,
      paymentDueMinutes: deps.paymentDueMinutes,
      frontendConfig: deps.registry.getFrontendConfig(driverKey as PaymentGatewayDriver) ?? undefined,
    };
  }

  /**
   * POST /invoices/:id/pay
   * Initiate payment via Payment Gateway (Midtrans / DANA / Xendit) untuk invoice tertentu
   * Returns: { paymentUrl, tokenId, expiredAt }
   */
  app.post("/invoices/:id/pay", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    try {
      const { id } = req.params as { id: string };
      const body = (req.body ?? {}) as {
        driver?: PaymentGatewayDriver;
        provider?: PaymentGatewayDriver;
        customerEmail?: string;
        customerName?: string;
        customerPhone?: string;
      };

      const selectedDriver = (body.driver || body.provider) as PaymentGatewayDriver | undefined;
      const serviceDeps = requirePaymentGateway(selectedDriver);

      const result = await initiatePayment(serviceDeps, {
        userId: session.userId,
        invoiceId: id,
        customerEmail: body.customerEmail,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
      });

      return result;
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /**
   * GET /invoices/:id/payment-status
   * Check payment status dari Payment Gateway
   * Juga bisa digunakan untuk polling status setelah payment
   */
  app.get("/invoices/:id/payment-status", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    try {
      const query = (req.query ?? {}) as { provider?: string };
      const gw = getGateway(query.provider);
      const serviceDeps = makeServiceDeps(gw);
      const { id } = req.params as { id: string };

      const result = await checkPaymentStatus(serviceDeps, {
        userId: session.userId,
        invoiceId: id,
      });

      return result;
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /**
   * GET /admin/invoices/:id/payment-status
   * Check payment status dari Payment Gateway untuk admin
   */
  app.get("/admin/invoices/:id/payment-status", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;

    try {
      const query = (req.query ?? {}) as { provider?: string };
      const gw = getGateway(query.provider);
      const serviceDeps = makeServiceDeps(gw);
      const { id } = req.params as { id: string };

      const result = await checkPaymentStatus(serviceDeps, {
        invoiceId: id,
      });

      return result;
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /**
   * GET /invoices/:id/payment-info
   * Get invoice dengan info payment gateway untuk frontend
   */
  app.get("/invoices/:id/payment-info", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    try {
      const { id } = req.params as { id: string };
      return await getInvoiceWithPaymentInfo(session.userId, id);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /**
   * POST /webhooks/midtrans
   * Webhook endpoint untuk menerima notifikasi dari Midtrans
   * TIDAK memerlukan authentication - divalidasi via signature key (SHA512)
   */
  app.post("/webhooks/midtrans", async (req, reply) => {
    try {
      const serviceDeps = requirePaymentGateway("midtrans");

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "string") {
          headers[key] = value;
        } else if (Array.isArray(value)) {
          headers[key] = value[0];
        }
      }

      app.log.info({
        event: "midtrans.webhook_received",
        hasBody: Boolean(req.body),
      });

      const result = await processPaymentNotification(serviceDeps, req.body, headers);

      app.log.info({
        event: "midtrans.webhook_processed",
        invoiceId: result.invoiceId,
        status: result.status,
      });

      // Midtrans expects 200 OK
      return { status: "OK", ...result };
    } catch (err) {
      app.log.error({
        event: "midtrans.webhook_error",
        error: err instanceof Error ? err.message : String(err),
      });

      if (err instanceof AuthError) {
        // Return 200 to prevent retries for permanent validation errors
        return reply.status(200).send({
          status: "ERROR",
          error: { code: err.code, message: err.message },
        });
      }

      // For unexpected internal errors, return 500 so Midtrans will retry
      return reply.status(500).send({
        status: "ERROR",
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  });

  /**
   * POST /webhooks/dana
   * Webhook endpoint untuk menerima Finish Notify dari DANA
   * Divalidasi via RSA-SHA256 signature (X-SIGNATURE header)
   */
  app.post("/webhooks/dana", async (req, reply) => {
    try {
      const danaGateway = deps.registry.get("dana");
      if (!danaGateway) {
        app.log.warn({ event: "dana.webhook_no_gateway" });
        return reply.status(200).send({
          responseCode: "5005601",
          responseMessage: "Internal Server Error",
        });
      }

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "string") {
          headers[key] = value;
        } else if (Array.isArray(value)) {
          headers[key] = value[0];
        }
      }

      app.log.info({
        event: "dana.webhook_received",
        hasBody: Boolean(req.body),
      });

      const serviceDeps: PaymentServiceDeps = {
        paymentGateway: danaGateway,
        callbackBaseUrl: deps.callbackBaseUrl,
        paymentDueMinutes: deps.paymentDueMinutes,
      };

      const result = await processPaymentNotification(serviceDeps, req.body, headers);

      app.log.info({
        event: "dana.webhook_processed",
        invoiceId: result.invoiceId,
        status: result.status,
      });

      // DANA expects specific response format
      return {
        responseCode: "2005600",
        responseMessage: "Successful",
      };
    } catch (err) {
      app.log.error({
        event: "dana.webhook_error",
        error: err instanceof Error ? err.message : String(err),
      });

      // Return 200 with error response code to prevent DANA retries for permanent errors
      if (err instanceof AuthError) {
        return reply.status(200).send({
          responseCode: "2005600",
          responseMessage: "Successful",
        });
      }

      // For unexpected errors, return 5005601 so DANA will retry
      return reply.status(200).send({
        responseCode: "5005601",
        responseMessage: "Internal Server Error",
      });
    }
  });

  /**
   * POST /webhooks/xendit & POST /webhook/xendit
   * Webhook endpoint untuk menerima notifikasi dari Xendit
   * TIDAK memerlukan authentication - divalidasi via x-callback-token
   */
  const handleXenditWebhook = async (req: any, reply: any) => {
    try {
      const xenditGateway = deps.registry.get("xendit");
      if (!xenditGateway) {
        return reply.status(503).send({
          status: "ERROR",
          error: { code: "GATEWAY_UNAVAILABLE", message: "Xendit gateway not configured" },
        });
      }

      const serviceDeps: PaymentServiceDeps = {
        paymentGateway: xenditGateway,
        callbackBaseUrl: deps.callbackBaseUrl,
        paymentDueMinutes: deps.paymentDueMinutes,
      };

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "string") {
          headers[key] = value;
        } else if (Array.isArray(value)) {
          headers[key] = value[0];
        }
      }

      app.log.info({
        event: "xendit.webhook_received",
        hasBody: Boolean(req.body),
      });

      const result = await processPaymentNotification(serviceDeps, req.body, headers);

      app.log.info({
        event: "xendit.webhook_processed",
        invoiceId: result.invoiceId,
        status: result.status,
      });

      return { status: "OK", ...result };
    } catch (err) {
      app.log.error({
        event: "xendit.webhook_error",
        error: err instanceof Error ? err.message : String(err),
      });

      if (err instanceof AuthError) {
        return reply.status(200).send({
          status: "ERROR",
          error: { code: err.code, message: err.message },
        });
      }

      return reply.status(500).send({
        status: "ERROR",
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  };

  app.post("/webhooks/xendit", handleXenditWebhook);
  app.post("/webhook/xendit", handleXenditWebhook);

  /**
   * GET /payment/methods
   * Get available payment methods
   */
  app.get("/payment/methods", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    const methods: Array<Record<string, unknown>> = [
      {
        id: "manual",
        name: "Transfer Manual",
        description: "Transfer ke rekening dan unggah bukti",
        enabled: true,
      },
    ];

    const defaultGateway = deps.registry.getDefault();
    const defaultProvider = defaultGateway?.provider ?? "";

    // Add Midtrans if registered
    const midtransConfig = deps.registry.getFrontendConfig("midtrans");
    if (midtransConfig) {
      const meta = (midtransConfig.meta ?? {}) as Record<string, unknown>;
      methods.push({
        id: "midtrans",
        name: "Pembayaran Online (Midtrans)",
        description: "Virtual Account (BCA, Mandiri, BNI, BRI, Permata), QRIS, GoPay, ShopeePay",
        enabled: true,
        isDefault: defaultProvider.includes("midtrans"),
        clientKey: meta.clientKey,
        isProduction: meta.isProduction,
        snapUrl: meta.snapUrl,
        flowType: meta.flowType ?? "snap",
        channels: [
          { id: "va", name: "Virtual Account", banks: ["BCA", "Mandiri", "BNI", "BRI", "Permata"] },
          { id: "qris", name: "QRIS", providers: ["GoPay", "ShopeePay", "BCA QRIS", "Dana", "OVO"] },
          { id: "gopay", name: "GoPay / QRIS" },
          { id: "shopeepay", name: "ShopeePay" },
          { id: "cc", name: "Kartu Kredit/Debit" },
        ],
      });
    }

    // Add DANA if registered
    const danaConfig = deps.registry.getFrontendConfig("dana");
    if (danaConfig) {
      methods.push({
        id: "dana",
        name: "Pembayaran Online (DANA)",
        description: "Bayar dengan saldo DANA, kartu kredit/debit, atau e-wallet lainnya",
        enabled: true,
        isDefault: defaultProvider.includes("dana"),
        flowType: "redirect",
      });
    }

    // Add Xendit if registered
    const xenditConfig = deps.registry.getFrontendConfig("xendit");
    if (xenditConfig) {
      methods.push({
        id: "xendit",
        name: "Pembayaran Online (Xendit)",
        description: "QRIS, E-Wallet (OVO, DANA, ShopeePay, LinkAja), Virtual Account / Transfer Bank",
        enabled: true,
        isDefault: defaultProvider.includes("xendit"),
        flowType: "redirect",
        channels: [
          { id: "qris", name: "QRIS", providers: ["Semua Pembayaran QRIS"] },
          { id: "ewallet", name: "E-Wallet", providers: ["OVO", "DANA", "ShopeePay", "LinkAja", "AstraPay", "JeniusPay"] },
          { id: "va", name: "Virtual Account", banks: ["BCA", "Mandiri", "BNI", "BRI", "Permata", "BSI", "CIMB Niaga"] },
        ],
      });
    }

    return { methods };
  });
}
