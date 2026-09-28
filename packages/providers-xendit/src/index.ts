/**
 * @ai-gen-free/providers-xendit
 * Xendit Payment Gateway Adapter (Payment Request API v3)
 */
import type { XenditConfig } from "./types.js";
import { XenditPaymentProvider } from "./xendit-payment.js";

export * from "./types.js";
export * from "./signature.js";
export * from "./xendit-payment.js";

/**
 * Factory function to create a Xendit Payment Gateway Provider
 */
export function createXenditProvider(config: XenditConfig): XenditPaymentProvider {
  return new XenditPaymentProvider(config);
}
