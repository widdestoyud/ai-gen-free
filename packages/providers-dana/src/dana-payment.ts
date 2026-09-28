import type { PaymentGatewayPort, CreatePaymentInput, CreatePaymentResult, NotificationVerifyResult, PaymentStatusResult } from "@ai-gen-free/core";
import type { DanaConfig, DanaCreateOrderRequest, DanaCreateOrderResponse, DanaQueryStatusRequest, DanaQueryStatusResponse, DanaNotificationPayload } from "./types.js";
import { SANDBOX_BASE_URL, PRODUCTION_BASE_URL, ENDPOINTS, TRANSACTION_STATUS } from "./constants.js";
import { buildCanonicalString, signRequest, verifyWebhookSignature, toPem, generateTimestamp, generateExternalId } from "./signature.js";

/**
 * DanaPaymentProvider implements PaymentGatewayPort for the DANA payment gateway.
 */
export class DanaPaymentProvider implements PaymentGatewayPort {
  public readonly provider = "dana-pg";
  
  private partnerId: string;
  private merchantId: string;
  private clientSecret: string;
  private privateKeyPem: string;
  private danaPublicKeyPem: string;
  private baseUrl: string;
  private origin: string;
  private notifyPath: string;

  constructor(config: DanaConfig) {
    if (!config.partnerId || !config.merchantId || !config.privateKey || !config.danaPublicKey) {
      throw new Error("Missing required DANA configuration fields.");
    }
    
    this.partnerId = config.partnerId;
    this.merchantId = config.merchantId;
    this.clientSecret = config.clientSecret;
    this.privateKeyPem = toPem(config.privateKey, "PRIVATE");
    this.danaPublicKeyPem = toPem(config.danaPublicKey, "PUBLIC");
    
    this.baseUrl = config.baseUrl || (config.isProduction ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL);
    this.origin = config.origin || "https://localhost";
    this.notifyPath = config.notifyPath || "/api/webhooks/dana";
  }

  private formatAmount(amount: number): string {
    return `${amount}.00`;
  }

  private mapTransactionStatus(status: string | undefined): "SUCCESS" | "FAILED" | "PENDING" {
    switch (status) {
      case TRANSACTION_STATUS.SUCCESS:
        return "SUCCESS";
      case TRANSACTION_STATUS.CANCELLED:
        return "FAILED";
      case TRANSACTION_STATUS.PENDING_INITIATED:
      case TRANSACTION_STATUS.PAYING:
      case TRANSACTION_STATUS.NOT_FOUND:
      default:
        return "PENDING";
    }
  }

  private async makeRequest<T>(method: string, endpointPath: string, body: object): Promise<T> {
    const timestamp = generateTimestamp();
    const externalId = generateExternalId();
    const bodyStr = JSON.stringify(body);
    
    const canonicalString = buildCanonicalString(method, endpointPath, bodyStr, timestamp);
    const signature = signRequest(canonicalString, this.privateKeyPem);
    
    const headers = {
      "Content-Type": "application/json",
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
      "X-PARTNER-ID": this.partnerId,
      "X-EXTERNAL-ID": externalId,
      "CHANNEL-ID": process.env.DANA_CHANNEL_ID || "95221",
      "ORIGIN": this.origin,
    };
    
    const url = `${this.baseUrl}${endpointPath}`;
    
    const response = await fetch(url, {
      method,
      headers,
      body: bodyStr,
    });
    
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok && !data) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return data as T;
  }

  public async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    try {
      const validUpToDate = new Date();
      // DANA Sandbox requires validUpTo to be at most 30 minutes in the future
      const dueMinutes = Math.min(input.paymentDueMinutes || 25, 25);
      validUpToDate.setMinutes(validUpToDate.getMinutes() + dueMinutes);
      
      const payload: DanaCreateOrderRequest = {
        partnerReferenceNo: input.invoiceNumber,
        merchantId: this.merchantId,
        amount: { value: this.formatAmount(input.amount), currency: "IDR" },
        validUpTo: generateTimestamp(validUpToDate),
        urlParams: [
          {
            url: input.callbackUrl || "https://localhost",
            type: "PAY_RETURN",
            isDeeplink: "false"
          },
          {
            url: `${this.origin}${this.notifyPath}`,
            type: "NOTIFICATION",
            isDeeplink: "false"
          }
        ],
        payOptionDetails: [
          {
            payMethod: "BALANCE",
            payOption: "BALANCE",
            transAmount: { value: this.formatAmount(input.amount), currency: "IDR" }
          }
        ],
        additionalInfo: {
          mcc: "4814",
          envInfo: { terminalType: "WEB" },
          order: { orderTitle: "Payment for Invoice" }
        }
      };
      
      const response = await this.makeRequest<DanaCreateOrderResponse>("POST", ENDPOINTS.CREATE_ORDER, payload);
      
      if (response.responseCode === "2005400" && response.webRedirectUrl) {
        return {
          success: true,
          paymentUrl: response.webRedirectUrl,
          sessionId: response.referenceNo,
          expiredDate: validUpToDate,
        };
      }
      
      return {
        success: false,
        error: response.responseMessage || "Failed to create DANA payment",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error creating DANA payment",
      };
    }
  }

  public async verifyNotification(payload: unknown, headers: Record<string, string>): Promise<NotificationVerifyResult> {
    try {
      const getHeader = (name: string) => {
        const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : undefined;
      };

      const signature = getHeader("x-signature");
      const timestamp = getHeader("x-timestamp");
      
      if (!signature || !timestamp) {
        return { valid: false, error: "Missing required signature headers" };
      }
      
      const bodyStr = typeof payload === "string" ? payload : JSON.stringify(payload);
      const canonicalString = buildCanonicalString("POST", this.notifyPath, bodyStr, timestamp);
      
      const isValid = verifyWebhookSignature(canonicalString, signature, this.danaPublicKeyPem);
      
      if (!isValid) {
        return { valid: false, error: "Invalid signature" };
      }
      
      const data = typeof payload === "string" ? JSON.parse(payload) as DanaNotificationPayload : payload as DanaNotificationPayload;
      
      return {
        valid: true,
        invoiceNumber: data.originalPartnerReferenceNo,
        amount: data.amount ? parseFloat(data.amount.value) : undefined,
        status: this.mapTransactionStatus(data.latestTransactionStatus),
        paymentChannel: "DANA",
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error verifying notification",
      };
    }
  }

  public async checkStatus(invoiceNumber: string): Promise<PaymentStatusResult> {
    try {
      const payload: DanaQueryStatusRequest = {
        merchantId: this.merchantId,
        serviceCode: "54",
        originalPartnerReferenceNo: invoiceNumber,
      };
      
      const response = await this.makeRequest<DanaQueryStatusResponse>("POST", ENDPOINTS.QUERY_STATUS, payload);
      
      if (response.responseCode !== "2005500") {
        return {
          found: false,
          error: response.responseMessage || "Transaction not found or error",
        };
      }
      
      const paidAt = response.paidTime ? new Date(response.paidTime) : undefined;
      const status = response.latestTransactionStatus === TRANSACTION_STATUS.NOT_FOUND
          ? "EXPIRED"
          : this.mapTransactionStatus(response.latestTransactionStatus);
          
      return {
        found: true,
        invoiceNumber,
        status: status as "SUCCESS" | "FAILED" | "PENDING" | "EXPIRED",
        amount: response.amount ? parseFloat(response.amount.value) : undefined,
        paymentChannel: "DANA",
        paidAt,
      };
    } catch (error) {
      return {
        found: false,
        error: error instanceof Error ? error.message : "Unknown error checking DANA status",
      };
    }
  }
}
