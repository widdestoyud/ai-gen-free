import type { DanaConfig } from "./types.js";
import { DanaPaymentProvider } from "./dana-payment.js";

export * from "./types.js";
export * from "./signature.js";
export * from "./constants.js";
export * from "./dana-payment.js";

/**
 * Creates a new DANA payment gateway provider.
 */
export function createDanaProvider(config: DanaConfig): DanaPaymentProvider {
  return new DanaPaymentProvider(config);
}
