/**
 * Midtrans Snap Payment Gateway Adapter
 * Implements PaymentGatewayPort using Midtrans Snap & Core API
 */
import type {
  PaymentGatewayPort,
  CreatePaymentInput,
  CreatePaymentResult,
  NotificationVerifyResult,
  PaymentStatusResult,
} from "@ai-gen-free/core";
import type {
  MidtransConfig,
  MidtransSnapRequest,
  MidtransSnapResponse,
  MidtransNotificationPayload,
  MidtransStatusResponse,
} from "./types.js";
import { verifyMidtransSignature } from "./signature.js";

const SANDBOX_SNAP_URL = "https://app.sandbox.midtrans.com";
const PRODUCTION_SNAP_URL = "https://app.midtrans.com";
const SANDBOX_CORE_API_URL = "https://api.sandbox.midtrans.com";
const PRODUCTION_CORE_API_URL = "https://api.midtrans.com";

export class MidtransSnapProvider implements PaymentGatewayPort {
  readonly provider = "midtrans-snap";
  private readonly config: MidtransConfig;
  private readonly snapBaseUrl: string;
  private readonly coreApiBaseUrl: string;

  constructor(config: MidtransConfig) {
    if (!config.serverKey) {
      throw new Error("MidtransSnapProvider requires serverKey");
    }
    this.config = config;
    this.snapBaseUrl =
      config.snapBaseUrl ??
      (config.isProduction ? PRODUCTION_SNAP_URL : SANDBOX_SNAP_URL);
    this.coreApiBaseUrl =
      config.coreApiBaseUrl ??
      (config.isProduction ? PRODUCTION_CORE_API_URL : SANDBOX_CORE_API_URL);
  }

  private getAuthHeader(): string {
    const token = Buffer.from(`${this.config.serverKey}:`).toString("base64");
    return `Basic ${token}`;
  }

  /**
   * Create Snap payment transaction
   */
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    try {
      const grossAmount = Math.round(input.amount);
      const paymentDueMinutes = input.paymentDueMinutes ?? 60;

      const itemDetails =
        input.lineItems && input.lineItems.length > 0
          ? input.lineItems.map((item, idx) => ({
              id: `item-${idx + 1}`,
              name: item.name.slice(0, 50),
              price: Math.round(item.price),
              quantity: item.quantity,
            }))
          : [
              {
                id: input.invoiceNumber,
                name: `Invoice ${input.invoiceNumber}`.slice(0, 50),
                price: grossAmount,
                quantity: 1,
              },
            ];

      const requestBody: MidtransSnapRequest = {
        transaction_details: {
          order_id: input.invoiceNumber,
          gross_amount: grossAmount,
        },
        item_details: itemDetails,
        customer_details: {
          first_name: input.customerName?.slice(0, 50),
          email: input.customerEmail,
          phone: input.customerPhone,
        },
        expiry: {
          unit: "minute",
          duration: paymentDueMinutes,
        },
      };

      if (input.callbackUrl) {
        requestBody.callbacks = {
          finish: input.callbackUrl,
        };
      }

      if (input.paymentMethods && input.paymentMethods.length > 0) {
        requestBody.enabled_payments = input.paymentMethods;
      }

      const url = `${this.snapBaseUrl}/snap/v1/transactions`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: this.getAuthHeader(),
        },
        body: JSON.stringify(requestBody),
      });

      const data = (await response.json()) as MidtransSnapResponse;

      if (!response.ok) {
        const errMsg =
          data.error_messages?.join(", ") ||
          `Midtrans Snap error HTTP ${response.status}`;
        return {
          success: false,
          error: errMsg,
        };
      }

      const expiredDate = new Date(Date.now() + paymentDueMinutes * 60 * 1000);

      return {
        success: true,
        paymentUrl: data.redirect_url,
        tokenId: data.token,
        sessionId: data.token,
        expiredDate,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Midtrans Snap createPayment exception: ${errorMsg}`,
      };
    }
  }

  /**
   * Verify HTTP notification webhook from Midtrans
   */
  async verifyNotification(
    payload: unknown,
    _headers: Record<string, string>,
  ): Promise<NotificationVerifyResult> {
    try {
      if (!payload || typeof payload !== "object") {
        return {
          valid: false,
          error: "Invalid notification payload: body must be a JSON object",
        };
      }

      const notif = payload as Partial<MidtransNotificationPayload>;

      if (!notif.order_id || !notif.status_code || !notif.gross_amount) {
        return {
          valid: false,
          error: "Missing required notification fields (order_id, status_code, gross_amount)",
        };
      }

      if (!notif.signature_key) {
        return {
          valid: false,
          error: "Missing signature_key in Midtrans notification",
        };
      }

      const isValidSignature = verifyMidtransSignature(notif.signature_key, {
        orderId: notif.order_id,
        statusCode: notif.status_code,
        grossAmount: notif.gross_amount,
        serverKey: this.config.serverKey,
      });

      if (!isValidSignature) {
        return {
          valid: false,
          error: "Invalid signature_key in Midtrans notification",
        };
      }

      const rawAmount = parseFloat(notif.gross_amount);
      const amount = Number.isNaN(rawAmount) ? 0 : rawAmount;
      const status = this.mapTransactionStatus(
        notif.transaction_status ?? "",
        notif.fraud_status,
      );

      let paymentChannel = notif.payment_type ?? "midtrans";
      if (notif.va_numbers && notif.va_numbers.length > 0 && notif.va_numbers[0]?.bank) {
        paymentChannel = `${notif.payment_type} (${notif.va_numbers[0].bank.toUpperCase()} VA)`;
      } else if (notif.bank) {
        paymentChannel = `${notif.payment_type} (${notif.bank.toUpperCase()})`;
      }

      return {
        valid: true,
        invoiceNumber: notif.order_id,
        amount,
        status,
        paymentChannel,
        paymentMethod: notif.payment_type,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        valid: false,
        error: `Midtrans verifyNotification exception: ${errorMsg}`,
      };
    }
  }

  /**
   * Check status via Core API
   */
  async checkStatus(invoiceNumber: string): Promise<PaymentStatusResult> {
    try {
      const url = `${this.coreApiBaseUrl}/v2/${encodeURIComponent(invoiceNumber)}/status`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: this.getAuthHeader(),
        },
      });

      const data = (await response.json()) as Partial<MidtransStatusResponse>;

      if (response.status === 404 || data.status_code === "404") {
        return {
          found: false,
          error: "Transaction not found on Midtrans",
        };
      }

      if (!response.ok) {
        return {
          found: false,
          error: data.status_message || `Midtrans API error HTTP ${response.status}`,
        };
      }

      const rawAmount = parseFloat(data.gross_amount ?? "0");
      const amount = Number.isNaN(rawAmount) ? undefined : rawAmount;
      const status = this.mapTransactionStatus(
        data.transaction_status ?? "",
        data.fraud_status,
      );

      let paidAt: Date | undefined;
      if (data.settlement_time) {
        paidAt = new Date(data.settlement_time);
      } else if (data.transaction_time && status === "SUCCESS") {
        paidAt = new Date(data.transaction_time);
      }

      const qrAction = data.actions?.find((a) => a.name === "generate-qr-code");
      const qrString = data.qr_string ?? qrAction?.url;
      const qrUrl = qrAction?.url;

      return {
        found: true,
        invoiceNumber: data.order_id ?? invoiceNumber,
        amount,
        status: status === "FAILED" && data.transaction_status === "expire" ? "EXPIRED" : status,
        paymentChannel: data.payment_type,
        paidAt,
        qrString,
        qrUrl,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        found: false,
        error: `Midtrans checkStatus exception: ${errorMsg}`,
      };
    }
  }

  /**
   * Maps Midtrans transaction_status & fraud_status to internal status
   */
  private mapTransactionStatus(
    transactionStatus: string,
    fraudStatus?: string,
  ): "SUCCESS" | "FAILED" | "PENDING" {
    switch (transactionStatus.toLowerCase()) {
      case "capture":
        if (fraudStatus?.toLowerCase() === "challenge") {
          return "PENDING";
        }
        if (fraudStatus?.toLowerCase() === "accept") {
          return "SUCCESS";
        }
        return "FAILED";

      case "settlement":
        return "SUCCESS";

      case "pending":
        return "PENDING";

      case "deny":
      case "cancel":
      case "expire":
      case "failure":
      case "refund":
      case "chargeback":
      default:
        return "FAILED";
    }
  }
}
