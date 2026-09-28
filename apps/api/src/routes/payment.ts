/**
 * Payment Routes - Midtrans Payment Gateway
 * Endpoints untuk initiate payment, webhook, dan check status
 */

import type { FastifyInstance } from "fastify";
import { ErrorCodes, type PaymentGatewayPort } from "@ai-gen-free/core";
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
  paymentGateway: PaymentGatewayPort | null;
  xenditGateway?: PaymentGatewayPort | null;
  callbackBaseUrl: string;
  paymentDueMinutes?: number;
}

export async function registerPaymentRoutes(app: FastifyInstance, deps: PaymentRouteDeps) {
  // Helper to get preferred or specific payment gateway
  function getGateway(preferredProvider?: string): PaymentGatewayPort {
    if (preferredProvider === "xendit" && deps.xenditGateway) {
      return deps.xenditGateway;
    }
    if (preferredProvider === "midtrans" && deps.paymentGateway) {
      return deps.paymentGateway;
    }
    // Default: use whichever is configured
    const gw = deps.paymentGateway ?? deps.xenditGateway;
    if (!gw) {
      throw new AuthError(
        ErrorCodes.PAYMENT_GATEWAY_ERROR,
        "Payment gateway tidak dikonfigurasi. Gunakan metode pembayaran manual.",
      );
    }
    return gw;
  }

  function makeServiceDeps(gw: PaymentGatewayPort): PaymentServiceDeps {
    return {
      paymentGateway: gw,
      callbackBaseUrl: deps.callbackBaseUrl,
      paymentDueMinutes: deps.paymentDueMinutes,
    };
  }

  /**
   * POST /invoices/:id/pay
   * Initiate payment via Payment Gateway (Midtrans / Xendit) untuk invoice tertentu
   * Returns: { paymentUrl, tokenId, expiredAt }
   */
  app.post("/invoices/:id/pay", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    try {
      const { id } = req.params as { id: string };
      const body = (req.body ?? {}) as {
        provider?: "midtrans" | "xendit";
        customerEmail?: string;
        customerName?: string;
        customerPhone?: string;
      };

      const gw = getGateway(body.provider);
      const serviceDeps = makeServiceDeps(gw);

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
      const gw = deps.paymentGateway;
      if (!gw) {
        return reply.status(503).send({
          status: "ERROR",
          error: { code: "GATEWAY_UNAVAILABLE", message: "Midtrans gateway not configured" },
        });
      }
      const serviceDeps = makeServiceDeps(gw);

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
   * POST /webhooks/xendit & POST /webhook/xendit
   * Webhook endpoint untuk menerima notifikasi dari Xendit
   * TIDAK memerlukan authentication - divalidasi via x-callback-token
   */
  const handleXenditWebhook = async (req: any, reply: any) => {
    try {
      const gw = deps.xenditGateway ?? (deps.paymentGateway?.provider.includes("xendit") ? deps.paymentGateway : null);
      if (!gw) {
        return reply.status(503).send({
          status: "ERROR",
          error: { code: "GATEWAY_UNAVAILABLE", message: "Xendit gateway not configured" },
        });
      }
      const serviceDeps = makeServiceDeps(gw);

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

      // Xendit expects 200 OK
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

    const hasMidtrans = deps.paymentGateway !== null;
    const hasXendit = deps.xenditGateway !== null && deps.xenditGateway !== undefined;
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true" || process.env.XENDIT_IS_PRODUCTION === "true";
    const clientKey = process.env.MIDTRANS_CLIENT_KEY;

    const methods: Array<Record<string, unknown>> = [
      {
        id: "manual",
        name: "Transfer Manual",
        description: "Transfer ke rekening dan unggah bukti",
        enabled: true,
      },
    ];

    if (hasMidtrans) {
      methods.push({
        id: "midtrans",
        name: "Pembayaran Online (Midtrans)",
        description: "Virtual Account (BCA, Mandiri, BNI, BRI, Permata), QRIS, GoPay, ShopeePay",
        enabled: true,
        clientKey: clientKey ?? undefined,
        isProduction,
        snapUrl: isProduction
          ? "https://app.midtrans.com/snap/snap.js"
          : "https://app.sandbox.midtrans.com/snap/snap.js",
        channels: [
          { id: "va", name: "Virtual Account", banks: ["BCA", "Mandiri", "BNI", "BRI", "Permata"] },
          { id: "qris", name: "QRIS", providers: ["GoPay", "ShopeePay", "BCA QRIS", "Dana", "OVO"] },
          { id: "gopay", name: "GoPay / QRIS" },
          { id: "shopeepay", name: "ShopeePay" },
          { id: "cc", name: "Kartu Kredit/Debit" },
        ],
      });
    }

    if (hasXendit) {
      methods.push({
        id: "xendit",
        name: "Pembayaran Online (Xendit)",
        description: "QRIS, E-Wallet (OVO, DANA, ShopeePay), Virtual Account (BCA, Mandiri, BNI, BRI), Kartu Kredit",
        enabled: true,
        isProduction: process.env.XENDIT_IS_PRODUCTION === "true",
        channels: [
          { id: "qris", name: "QRIS", providers: ["Semua Pembayaran QRIS"] },
          { id: "ewallet", name: "E-Wallet", providers: ["OVO", "DANA", "ShopeePay", "LinkAja", "GoPay"] },
          { id: "va", name: "Virtual Account", banks: ["BCA", "Mandiri", "BNI", "BRI", "Permata", "BSI"] },
          { id: "card", name: "Kartu Kredit/Debit" },
          { id: "otc", name: "Retail Outlet", outlets: ["Alfamart", "Indomaret"] },
        ],
      });
    }

    return { methods };
  });
}
