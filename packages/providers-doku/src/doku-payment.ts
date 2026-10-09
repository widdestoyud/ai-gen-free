/**
 * DOKU Payment Gateway Adapter
 * Implements PaymentGatewayPort using DOKU Direct API & DOKU Checkout
 *
 * @see https://developers.doku.com/accept-payments/direct-api
 * @see https://developers.doku.com/accept-payments/doku-checkout
 */

import { randomUUID } from "node:crypto";
import type {
  PaymentGatewayPort,
  CreatePaymentInput,
  CreatePaymentResult,
  NotificationVerifyResult,
  PaymentStatusResult,
} from "@ai-gen-free/core";
import type {
  DokuConfig,
  DokuCheckoutRequest,
  DokuCheckoutResponse,
  DokuNotificationPayload,
  DokuCheckStatusResponse,
} from "./types.js";
import {
  generateDokuSignature,
  verifyDokuNotificationSignature,
} from "./signature.js";

const DEFAULT_SANDBOX_BASE_URL = "https://api-sandbox.doku.com";
const DEFAULT_PROD_BASE_URL = "https://api.doku.com";
const DEFAULT_NOTIFICATION_PATH = "/webhooks/doku";

/**
 * Parses DOKU date format "yyyyMMddHHmmss" (in UTC+7) or ISO date string into Date object.
 */
function parseDokuDate(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;

  // Format: yyyyMMddHHmmss (e.g., 20240712104711)
  if (/^\d{14}$/.test(dateStr)) {
    const year = Number.parseInt(dateStr.substring(0, 4), 10);
    const month = Number.parseInt(dateStr.substring(4, 6), 10) - 1;
    const day = Number.parseInt(dateStr.substring(6, 8), 10);
    const hour = Number.parseInt(dateStr.substring(8, 10), 10);
    const minute = Number.parseInt(dateStr.substring(10, 12), 10);
    const second = Number.parseInt(dateStr.substring(12, 14), 10);
    // DOKU uses UTC+7 (WIB) for this format, so subtract 7 hours for UTC Date
    return new Date(Date.UTC(year, month, day, hour - 7, minute, second));
  }

  // Standard ISO string
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export class DokuPaymentProvider implements PaymentGatewayPort {
  readonly provider = "doku";
  private readonly config: DokuConfig;
  private readonly baseUrl: string;
  private readonly notificationPath: string;

  constructor(config: DokuConfig) {
    if (!config.clientId) {
      throw new Error("DokuPaymentProvider requires clientId");
    }
    if (!config.secretKey) {
      throw new Error("DokuPaymentProvider requires secretKey");
    }
    this.config = config;
    this.baseUrl =
      config.baseUrl ??
      (config.isProduction ? DEFAULT_PROD_BASE_URL : DEFAULT_SANDBOX_BASE_URL);
    this.notificationPath = config.notificationPath ?? DEFAULT_NOTIFICATION_PATH;
  }

  private getCurrentIsoTimestamp(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  /**
   * Helper to look up header values case-insensitively
   */
  private getHeader(headers: Record<string, string>, name: string): string | undefined {
    const targetKey = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === targetKey) {
        return value;
      }
    }
    return undefined;
  }

  /**
   * Create Checkout Payment session via DOKU API
   * POST /checkout/v1/payment
   */
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    try {
      const amount = Math.round(input.amount);
      const paymentDueDate = input.paymentDueMinutes ?? 60;
      const targetPath = "/checkout/v1/payment";
      const requestId = randomUUID();
      const requestTimestamp = this.getCurrentIsoTimestamp();

      const requestBody: DokuCheckoutRequest = {
        order: {
          amount,
          invoice_number: input.invoiceNumber,
          currency: "IDR",
          auto_redirect: true,
        },
        payment: {
          payment_due_date: paymentDueDate,
        },
      };

      const successUrl = input.successRedirectUrl || input.callbackUrl;
      const cancelUrl = input.cancelRedirectUrl || input.failureRedirectUrl || input.callbackUrl;
      const resultUrl = input.callbackUrl || successUrl;

      if (successUrl) {
        requestBody.order.callback_url = successUrl;
      }
      if (cancelUrl) {
        requestBody.order.callback_url_cancel = cancelUrl;
      }
      if (resultUrl) {
        requestBody.order.callback_url_result = resultUrl;
      }

      const allowedMethods =
        input.paymentMethods && input.paymentMethods.length > 0
          ? input.paymentMethods
          : this.config.paymentMethods;

      if (allowedMethods && allowedMethods.length > 0) {
        requestBody.payment!.payment_method_types = allowedMethods;
      }

      if (input.customerName || input.customerEmail || input.customerPhone) {
        requestBody.customer = {
          name: input.customerName ? input.customerName.slice(0, 255) : undefined,
          email: input.customerEmail ? input.customerEmail.slice(0, 128) : undefined,
          phone: input.customerPhone ? input.customerPhone.slice(0, 16) : undefined,
        };
      }

      if (input.lineItems && input.lineItems.length > 0) {
        requestBody.order.line_items = input.lineItems.map((item) => ({
          name: item.name.slice(0, 255),
          price: Math.round(item.price),
          quantity: item.quantity,
        }));
      }

      const bodyJson = JSON.stringify(requestBody);
      const signature = generateDokuSignature({
        clientId: this.config.clientId,
        requestId,
        requestTimestamp,
        requestTarget: targetPath,
        rawBody: bodyJson,
        secretKey: this.config.secretKey,
      });

      const url = `${this.baseUrl}${targetPath}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Id": this.config.clientId,
          "Request-Id": requestId,
          "Request-Timestamp": requestTimestamp,
          Signature: signature,
        },
        body: bodyJson,
      });

      const data = (await response.json()) as DokuCheckoutResponse;

      if (!response.ok || !data.response?.payment?.url) {
        const errorMsg =
          data.error_messages?.join(", ") ||
          data.error?.message ||
          `DOKU API error (${response.status}): ${JSON.stringify(data)}`;
        return {
          success: false,
          error: errorMsg,
        };
      }

      const paymentUrl = data.response.payment.url;
      const tokenId = data.response.payment.token_id;
      const sessionId = data.response.order?.session_id;
      const expiredDate = parseDokuDate(data.response.payment.expired_date);

      return {
        success: true,
        paymentUrl,
        tokenId,
        sessionId,
        expiredDate,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Verify Webhook / HTTP Notification from DOKU
   */
  async verifyNotification(
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<NotificationVerifyResult> {
    try {
      const clientId = this.getHeader(headers, "client-id");
      const requestId = this.getHeader(headers, "request-id");
      const requestTimestamp = this.getHeader(headers, "request-timestamp");
      const signature = this.getHeader(headers, "signature");

      const explicitTarget =
        this.getHeader(headers, "request-target") ||
        this.getHeader(headers, "x-request-target") ||
        this.getHeader(headers, "x-original-uri") ||
        this.getHeader(headers, "x-forwarded-uri");

      const candidateTargets = Array.from(
        new Set(
          [
            explicitTarget,
            this.notificationPath,
            "/api/webhooks/doku",
            "/webhooks/doku",
            "/api/webhook/doku",
            "/webhook/doku",
          ].filter(Boolean) as string[],
        ),
      );

      // Verify signature across possible target paths
      let isValid = false;
      for (const target of candidateTargets) {
        if (
          verifyDokuNotificationSignature({
            clientId,
            requestId,
            requestTimestamp,
            requestTarget: target,
            incomingSignature: signature,
            rawBody: payload as object,
            secretKey: this.config.secretKey,
          })
        ) {
          isValid = true;
          break;
        }
      }

      if (!isValid) {
        return {
          valid: false,
          error: "Invalid DOKU signature",
        };
      }

      const body = payload as DokuNotificationPayload;
      const invoiceNumber = body.order?.invoice_number;
      const amount = body.order?.amount ? Number(body.order.amount) : undefined;
      const rawStatus = (body.transaction?.status || "").toUpperCase();

      let status: "SUCCESS" | "FAILED" | "PENDING" = "PENDING";
      if (rawStatus === "SUCCESS") {
        status = "SUCCESS";
      } else if (
        rawStatus === "FAILED" ||
        rawStatus === "EXPIRED" ||
        rawStatus === "VOIDED" ||
        rawStatus === "REFUNDED" ||
        rawStatus === "TIMEOUT"
      ) {
        status = "FAILED";
      } else {
        status = "PENDING";
      }

      const paymentChannel = body.channel?.id || body.channel?.name;
      const paymentMethod = body.service?.id || body.service?.name;

      return {
        valid: true,
        invoiceNumber,
        amount,
        status,
        paymentChannel,
        paymentMethod,
      };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Check status of a transaction via Check Status API
   * GET /orders/v1/status/{invoiceNumber}
   */
  async checkStatus(invoiceNumber: string): Promise<PaymentStatusResult> {
    try {
      const targetPath = `/orders/v1/status/${encodeURIComponent(invoiceNumber)}`;
      const requestId = randomUUID();
      const requestTimestamp = this.getCurrentIsoTimestamp();

      const signature = generateDokuSignature({
        clientId: this.config.clientId,
        requestId,
        requestTimestamp,
        requestTarget: targetPath,
        secretKey: this.config.secretKey,
      });

      const url = `${this.baseUrl}${targetPath}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Client-Id": this.config.clientId,
          "Request-Id": requestId,
          "Request-Timestamp": requestTimestamp,
          Signature: signature,
        },
      });

      if (response.status === 404) {
        return {
          found: false,
          invoiceNumber,
          error: "Transaction not found on DOKU",
        };
      }

      const data = (await response.json()) as DokuCheckStatusResponse;

      if (!response.ok) {
        const errorMsg =
          data.error_messages?.join(", ") ||
          `DOKU Check Status API error (${response.status})`;
        return {
          found: false,
          invoiceNumber,
          error: errorMsg,
        };
      }

      const rawStatus = (data.transaction?.status || "").toUpperCase();
      let status: "SUCCESS" | "FAILED" | "PENDING" | "EXPIRED" = "PENDING";

      if (rawStatus === "SUCCESS") {
        status = "SUCCESS";
      } else if (rawStatus === "EXPIRED") {
        status = "EXPIRED";
      } else if (
        rawStatus === "FAILED" ||
        rawStatus === "VOIDED" ||
        rawStatus === "REFUNDED" ||
        rawStatus === "TIMEOUT"
      ) {
        status = "FAILED";
      } else {
        status = "PENDING";
      }

      const amount = data.order?.amount ? Number(data.order.amount) : undefined;
      const paymentChannel = data.channel?.id || data.channel?.name;
      const paidAt = parseDokuDate(data.transaction?.date);

      return {
        found: true,
        invoiceNumber: data.order?.invoice_number || invoiceNumber,
        amount,
        status,
        paymentChannel,
        paidAt,
      };
    } catch (err) {
      return {
        found: false,
        invoiceNumber,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

/**
 * Factory function to create DokuPaymentProvider instance
 */
export function createDokuProvider(config: DokuConfig): DokuPaymentProvider {
  return new DokuPaymentProvider(config);
}
