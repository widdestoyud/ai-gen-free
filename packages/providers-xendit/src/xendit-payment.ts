/**
 * Xendit Payment Gateway Adapter
 * Implements PaymentGatewayPort using Xendit Invoices & Payment Request APIs
 *
 * @see https://docs.xendit.co/apidocs/
 */
import type {
  PaymentGatewayPort,
  CreatePaymentInput,
  CreatePaymentResult,
  NotificationVerifyResult,
  PaymentStatusResult,
} from "@ai-gen-free/core";
import type {
  XenditConfig,
  XenditWebhookPayload,
} from "./types.js";
import { verifyXenditCallbackToken } from "./signature.js";

const DEFAULT_BASE_URL = "https://api.xendit.co";

interface XenditInvoiceResponse {
  id: string;
  external_id: string;
  user_id: string;
  status: "PENDING" | "PAID" | "SETTLED" | "EXPIRED";
  merchant_name: string;
  amount: number;
  payer_email?: string;
  description?: string;
  invoice_url: string;
  expiry_date: string;
  payment_method?: string;
  payment_channel?: string;
  paid_amount?: number;
  paid_at?: string;
  message?: string;
  error_code?: string;
}

export class XenditPaymentProvider implements PaymentGatewayPort {
  readonly provider = "xendit";
  private readonly config: XenditConfig;
  private readonly baseUrl: string;

  constructor(config: XenditConfig) {
    if (!config.apiKey) {
      throw new Error("XenditPaymentProvider requires apiKey");
    }
    this.config = config;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  private getAuthHeader(): string {
    const token = Buffer.from(`${this.config.apiKey}:`).toString("base64");
    return `Basic ${token}`;
  }

  /**
   * Create invoice checkout session via Xendit API
   * POST /v2/invoices
   */
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    try {
      const amount = Math.round(input.amount);
      const paymentDueMinutes = input.paymentDueMinutes ?? 60;
      const durationSeconds = paymentDueMinutes * 60;

      const requestBody: Record<string, unknown> = {
        external_id: input.invoiceNumber,
        amount,
        description: `Invoice ${input.invoiceNumber}`,
        invoice_duration: durationSeconds,
        currency: "IDR",
        reminder_time: 1,
      };

      if (input.customerEmail) {
        requestBody.payer_email = input.customerEmail;
      }
      if (input.customerName) {
        requestBody.customer = {
          given_names: input.customerName.slice(0, 50),
          email: input.customerEmail,
          mobile_number: input.customerPhone,
        };
      }
      if (input.callbackUrl) {
        requestBody.success_redirect_url = input.callbackUrl;
        requestBody.failure_redirect_url = input.callbackUrl;
      }
      if (input.lineItems && input.lineItems.length > 0) {
        requestBody.items = input.lineItems.map((item) => ({
          name: item.name.slice(0, 256),
          price: Math.round(item.price),
          quantity: item.quantity,
        }));
      }

      const url = `${this.baseUrl}/v2/invoices`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: this.getAuthHeader(),
        },
        body: JSON.stringify(requestBody),
      });

      const data = (await response.json()) as XenditInvoiceResponse;

      if (!response.ok) {
        const errMsg =
          data.message ?? data.error_code ?? `Xendit API error HTTP ${response.status}`;
        return {
          success: false,
          error: errMsg,
        };
      }

      const expiredDate = data.expiry_date
        ? new Date(data.expiry_date)
        : new Date(Date.now() + durationSeconds * 1000);

      return {
        success: true,
        paymentUrl: data.invoice_url,
        tokenId: data.id,
        sessionId: data.id,
        expiredDate,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Xendit createPayment exception: ${errorMsg}`,
      };
    }
  }

  /**
   * Verify webhook notification from Xendit
   * Handles both Invoice webhooks and Payment Request webhooks
   */
  async verifyNotification(
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<NotificationVerifyResult> {
    try {
      if (!payload || typeof payload !== "object") {
        return {
          valid: false,
          error: "Invalid notification payload: body must be a JSON object",
        };
      }

      // Verify callback token if configured
      if (this.config.webhookToken) {
        const callbackToken =
          headers["x-callback-token"] || headers["X-CALLBACK-TOKEN"];
        const isValidToken = verifyXenditCallbackToken(
          callbackToken,
          this.config.webhookToken,
        );

        if (!isValidToken) {
          return {
            valid: false,
            error: "Invalid x-callback-token in Xendit webhook",
          };
        }
      }

      const body = payload as Record<string, any>;

      // 1. Check if it's an Invoice Webhook payload (external_id & status directly on body)
      if (body.external_id && body.status) {
        const rawStatus = String(body.status).toUpperCase();
        let status: "SUCCESS" | "FAILED" | "PENDING" = "PENDING";
        if (rawStatus === "PAID" || rawStatus === "SETTLED") {
          status = "SUCCESS";
        } else if (rawStatus === "EXPIRED" || rawStatus === "FAILED") {
          status = "FAILED";
        }

        const rawAmount = parseFloat(body.paid_amount ?? body.amount ?? "0");
        const amount = Number.isNaN(rawAmount) ? 0 : rawAmount;

        return {
          valid: true,
          invoiceNumber: body.external_id,
          amount,
          status,
          paymentChannel: body.payment_channel ?? body.payment_method ?? "xendit",
          paymentMethod: body.payment_method ?? "xendit",
        };
      }

      // 2. Check if it's a Payment Request / v3 Webhook payload (event & data)
      const webhook = payload as Partial<XenditWebhookPayload>;
      if (webhook.event && webhook.data) {
        const data = webhook.data;
        if (!data.reference_id) {
          return {
            valid: false,
            error: "Missing reference_id in Xendit webhook data",
          };
        }

        const status = this.mapWebhookEventToStatus(webhook.event);
        const paymentMethodType = data.payment_method?.type ?? "xendit";
        const channelCode = data.channel_code ?? paymentMethodType;

        return {
          valid: true,
          invoiceNumber: data.reference_id,
          amount: data.amount,
          status,
          paymentChannel: channelCode,
          paymentMethod: paymentMethodType,
        };
      }

      return {
        valid: false,
        error: "Unrecognized Xendit webhook payload structure",
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        valid: false,
        error: `Xendit verifyNotification exception: ${errorMsg}`,
      };
    }
  }

  /**
   * Check payment status via Xendit API
   * Queries invoice status by external_id
   */
  async checkStatus(invoiceNumber: string): Promise<PaymentStatusResult> {
    try {
      // 1. Query Invoice API by external_id
      const url = `${this.baseUrl}/v2/invoices?external_id=${encodeURIComponent(invoiceNumber)}&limit=1`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: this.getAuthHeader(),
        },
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { message?: string };
        return {
          found: false,
          error: errBody.message ?? `Xendit API error HTTP ${response.status}`,
        };
      }

      const invoices = (await response.json()) as XenditInvoiceResponse[];

      if (!Array.isArray(invoices) || invoices.length === 0) {
        return {
          found: false,
          error: "Transaction not found on Xendit",
        };
      }

      const inv = invoices[0];
      const rawStatus = String(inv.status).toUpperCase();
      let status: "SUCCESS" | "FAILED" | "PENDING" | "EXPIRED" = "PENDING";
      if (rawStatus === "PAID" || rawStatus === "SETTLED") {
        status = "SUCCESS";
      } else if (rawStatus === "EXPIRED") {
        status = "EXPIRED";
      } else if (rawStatus === "FAILED") {
        status = "FAILED";
      }

      let paidAt: Date | undefined;
      if (inv.paid_at && status === "SUCCESS") {
        paidAt = new Date(inv.paid_at);
      }

      return {
        found: true,
        invoiceNumber: inv.external_id ?? invoiceNumber,
        amount: inv.paid_amount ?? inv.amount,
        status,
        paymentChannel: inv.payment_channel ?? inv.payment_method,
        paidAt,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        found: false,
        error: `Xendit checkStatus exception: ${errorMsg}`,
      };
    }
  }

  /**
   * Maps Xendit webhook event to internal status
   */
  private mapWebhookEventToStatus(
    event: string,
  ): "SUCCESS" | "FAILED" | "PENDING" {
    switch (event) {
      case "payment.succeeded":
      case "invoice.paid":
        return "SUCCESS";
      case "payment.failed":
      case "invoice.expired":
        return "FAILED";
      case "payment.pending":
      case "payment.awaiting_capture":
      case "invoice.pending":
        return "PENDING";
      default:
        if (event.startsWith("payment.failed") || event.startsWith("refund.")) {
          return "FAILED";
        }
        return "PENDING";
    }
  }
}
