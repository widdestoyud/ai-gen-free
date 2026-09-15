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
    (typeof req.headers["x-session-token"] === "string" && (req.headers["x-session-token"] as string).trim().length > 0
      ? (req.headers["x-session-token"] as string).trim()
      : undefined) ??
    (typeof req.headers["authorization"] === "string" && (req.headers["authorization"] as string).toLowerCase().startsWith("bearer ")
      ? (req.headers["authorization"] as string).slice(7).trim()
      : undefined);

  const session = await userFromCookie(token, "user");
  if (!session) {
    reply.status(401).send({ error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk" } });
    return null;
  }
  return session;
}

export interface PaymentRouteDeps {
  paymentGateway: PaymentGatewayPort | null;
  callbackBaseUrl: string;
  paymentDueMinutes?: number;
}

export async function registerPaymentRoutes(app: FastifyInstance, deps: PaymentRouteDeps) {
  // Helper to check if payment gateway is configured
  function requirePaymentGateway(): PaymentServiceDeps {
    if (!deps.paymentGateway) {
      throw new AuthError(
        ErrorCodes.PAYMENT_GATEWAY_ERROR,
        "Payment gateway tidak dikonfigurasi. Gunakan metode pembayaran manual.",
      );
    }
    return {
      paymentGateway: deps.paymentGateway,
      callbackBaseUrl: deps.callbackBaseUrl,
      paymentDueMinutes: deps.paymentDueMinutes,
    };
  }

  /**
   * POST /invoices/:id/pay
   * Initiate payment via Midtrans Snap untuk invoice tertentu
   * Returns: { paymentUrl, tokenId, expiredAt }
   */
  app.post("/invoices/:id/pay", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    try {
      const serviceDeps = requirePaymentGateway();
      const { id } = req.params as { id: string };
      const body = (req.body ?? {}) as {
        customerEmail?: string;
        customerName?: string;
        customerPhone?: string;
      };

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
   * Check payment status dari Midtrans
   * Juga bisa digunakan untuk polling status setelah payment
   */
  app.get("/invoices/:id/payment-status", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    try {
      const serviceDeps = requirePaymentGateway();
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
      const serviceDeps = requirePaymentGateway();

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
   * GET /payment/methods
   * Get available payment methods
   */
  app.get("/payment/methods", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    const hasMidtrans = deps.paymentGateway !== null;
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const clientKey = process.env.MIDTRANS_CLIENT_KEY;

    return {
      methods: [
        {
          id: "manual",
          name: "Transfer Manual",
          description: "Transfer ke rekening dan unggah bukti",
          enabled: true,
        },
        {
          id: "midtrans",
          name: "Pembayaran Online (Midtrans)",
          description: "Virtual Account (BCA, Mandiri, BNI, BRI, Permata), QRIS, GoPay, ShopeePay",
          enabled: hasMidtrans,
          clientKey: clientKey ?? undefined,
          isProduction,
          snapUrl: isProduction
            ? "https://app.midtrans.com/snap/snap.js"
            : "https://app.sandbox.midtrans.com/snap/snap.js",
          channels: hasMidtrans
            ? [
                { id: "va", name: "Virtual Account", banks: ["BCA", "Mandiri", "BNI", "BRI", "Permata"] },
                { id: "qris", name: "QRIS", providers: ["GoPay", "ShopeePay", "BCA QRIS", "Dana", "OVO"] },
                { id: "gopay", name: "GoPay / QRIS" },
                { id: "shopeepay", name: "ShopeePay" },
                { id: "cc", name: "Kartu Kredit/Debit" },
              ]
            : undefined,
        },
      ],
    };
  });
}
