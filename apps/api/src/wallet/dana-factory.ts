import type { PaymentGatewayPort } from "@ai-gen-free/core";
import { createDanaProvider } from "@ai-gen-free/providers-dana";

interface Logger {
  info: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}

/**
 * Creates a DANA Payment Gateway port using environment variables.
 */
export function createDanaPaymentGateway(logger?: Logger): PaymentGatewayPort | null {
  const partnerId = process.env.DANA_PARTNER_ID;
  const merchantId = process.env.DANA_MERCHANT_ID;
  const clientSecret = process.env.DANA_CLIENT_SECRET;
  const privateKey = process.env.DANA_PRIVATE_KEY;
  const danaPublicKey = process.env.DANA_PUBLIC_KEY;
  
  if (!partnerId || !privateKey) {
    logger?.info({ partnerId: !!partnerId, privateKey: !!privateKey }, "DANA provider not configured");
    return null;
  }
  
  if (!merchantId || !clientSecret || !danaPublicKey) {
    logger?.error({}, "DANA configuration is incomplete");
    return null;
  }
  
  try {
    return createDanaProvider({
      partnerId,
      merchantId,
      clientSecret,
      privateKey,
      danaPublicKey,
      isProduction: process.env.DANA_IS_PRODUCTION === "true",
      origin: process.env.DANA_ORIGIN,
      baseUrl: process.env.DANA_BASE_URL,
      notifyPath: process.env.DANA_NOTIFY_PATH,
    });
  } catch (err) {
    logger?.error({ err }, "Failed to initialize DANA payment gateway");
    return null;
  }
}
