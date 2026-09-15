/**
 * Midtrans Payment Gateway Factory
 * Creates Midtrans provider instance from environment variables
 *
 * Mapping kredensial Midtrans Dashboard ke environment variables:
 *
 * | Midtrans Dashboard   | Environment Variable    | Keterangan                       |
 * |---------------------|-------------------------|----------------------------------|
 * | Server Key          | MIDTRANS_SERVER_KEY     | Server Key untuk autentikasi API |
 * | Client Key          | MIDTRANS_CLIENT_KEY     | Client Key untuk Snap UI/Frontend|
 * | Merchant ID         | MIDTRANS_MERCHANT_ID    | Merchant ID dari akun Midtrans   |
 * | Environment         | MIDTRANS_IS_PRODUCTION  | true / false (default false)     |
 */

import type { PaymentGatewayPort } from "@ai-gen-free/core";
import { createMidtransProvider, type MidtransConfig } from "@ai-gen-free/providers-midtrans";

interface Logger {
  info: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}

/**
 * Create Midtrans payment gateway from environment variables
 * Returns null if Midtrans is not configured
 */
export function createMidtransPaymentGateway(logger?: Logger): PaymentGatewayPort | null {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const clientKey = process.env.MIDTRANS_CLIENT_KEY;
  const merchantId = process.env.MIDTRANS_MERCHANT_ID;
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

  if (!serverKey) {
    logger?.info({
      event: "midtrans.not_configured",
      message: "MIDTRANS_SERVER_KEY tidak dikonfigurasi, menggunakan pembayaran manual",
    });
    return null;
  }

  const config: MidtransConfig = {
    serverKey,
    clientKey,
    merchantId,
    isProduction,
    snapBaseUrl: process.env.MIDTRANS_SNAP_BASE_URL,
    coreApiBaseUrl: process.env.MIDTRANS_CORE_API_BASE_URL,
  };

  logger?.info({
    event: "midtrans.configured",
    isProduction,
    merchantId: merchantId ?? "(not specified)",
    clientKey: clientKey ? `${clientKey.substring(0, 10)}...` : "(not specified)",
  });

  return createMidtransProvider(config);
}
