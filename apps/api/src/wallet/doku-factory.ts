/**
 * DOKU Payment Gateway Factory
 * Creates DOKU provider instance from environment variables
 *
 * Mapping kredensial DOKU Dashboard ke environment variables:
 *
 * | DOKU Dashboard      | Environment Variable    | Keterangan                             |
 * |---------------------|-------------------------|----------------------------------------|
 * | Client ID / Mall ID | DOKU_CLIENT_ID          | Client ID untuk autentikasi API        |
 * | Secret / Shared Key | DOKU_SECRET_KEY         | Shared Secret Key untuk HMAC Signature |
 * | Environment         | DOKU_IS_PRODUCTION      | true / false (default false)           |
 * | API Base URL        | DOKU_BASE_URL           | Opsional custom API endpoint           |
 * | Webhook Path        | DOKU_NOTIFICATION_PATH  | Opsional custom path notification      |
 */

import type { PaymentGatewayPort } from "@ai-gen-free/core";
import { createDokuProvider, type DokuConfig } from "@ai-gen-free/providers-doku";

interface Logger {
  info: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}

/**
 * Create DOKU payment gateway from environment variables
 * Returns null if DOKU is not configured
 */
export function createDokuPaymentGateway(logger?: Logger): PaymentGatewayPort | null {
  const clientId =
    process.env.DOKU_CLIENT_ID ||
    process.env.DOKU_MERCHANT_KEY ||
    process.env.DOKU_MALL_ID;
  const secretKey =
    process.env.DOKU_SECRET_KEY ||
    process.env.DOKU_API_KEY ||
    process.env.DOKU_SHARED_KEY;
  const publicKey = process.env.DOKU_PUBLIC_KEY;
  const isProduction = process.env.DOKU_IS_PRODUCTION === "true";

  if (!clientId || !secretKey) {
    logger?.info({
      event: "doku.not_configured",
      message: "DOKU_CLIENT_ID / DOKU_SECRET_KEY tidak dikonfigurasi, DOKU tidak tersedia",
    });
    return null;
  }

  const config: DokuConfig = {
    clientId,
    secretKey,
    publicKey,
    isProduction,
    baseUrl: process.env.DOKU_BASE_URL,
    notificationPath: process.env.DOKU_NOTIFICATION_PATH,
  };

  logger?.info({
    event: "doku.configured",
    clientId: `${clientId.substring(0, 8)}...`,
    hasPublicKey: Boolean(publicKey),
    isProduction,
  });

  return createDokuProvider(config);
}
