/**
 * Xendit Payment Gateway Factory
 * Creates Xendit provider instance from environment variables
 *
 * Mapping kredensial Xendit Dashboard ke environment variables:
 *
 * | Xendit Dashboard     | Environment Variable    | Keterangan                         |
 * |---------------------|-------------------------|------------------------------------|
 * | Secret API Key      | XENDIT_API_KEY          | Secret Key untuk autentikasi API   |
 * | Public API Key      | XENDIT_PUB_KEY          | Public Key untuk frontend/Session  |
 * | Webhook Token       | XENDIT_WEBHOOK_TOKEN    | Verification token untuk webhook   |
 * | Environment         | XENDIT_IS_PRODUCTION    | true / false (default false)       |
 */

import type { PaymentGatewayPort } from "@ai-gen-free/core";
import { createXenditProvider, type XenditConfig } from "@ai-gen-free/providers-xendit";

interface Logger {
  info: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}

/**
 * Create Xendit payment gateway from environment variables
 * Returns null if Xendit is not configured
 */
export function createXenditPaymentGateway(logger?: Logger): PaymentGatewayPort | null {
  const apiKey = process.env.XENDIT_API_KEY;
  const publicKey = process.env.XENDIT_PUB_KEY;
  const webhookToken = process.env.XENDIT_WEBHOOK_TOKEN;
  const isProduction = process.env.XENDIT_IS_PRODUCTION === "true";

  if (!apiKey) {
    logger?.info({
      event: "xendit.not_configured",
      message: "XENDIT_API_KEY tidak dikonfigurasi, Xendit tidak tersedia",
    });
    return null;
  }

  const config: XenditConfig = {
    apiKey,
    publicKey,
    webhookToken,
    isProduction,
    baseUrl: process.env.XENDIT_BASE_URL,
  };

  logger?.info({
    event: "xendit.configured",
    isProduction,
    publicKey: publicKey ? `${publicKey.substring(0, 15)}...` : "(not specified)",
    hasWebhookToken: Boolean(webhookToken),
  });

  return createXenditProvider(config);
}
