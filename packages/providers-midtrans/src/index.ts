/**
 * @ai-gen-free/providers-midtrans
 * Midtrans Payment Gateway Adapter (Snap & Core API)
 */
import type { MidtransConfig } from "./types.js";
import { MidtransSnapProvider } from "./midtrans-snap.js";

export * from "./types.js";
export * from "./signature.js";
export * from "./midtrans-snap.js";

/**
 * Factory function to create a Midtrans Snap Payment Gateway Provider
 */
export function createMidtransProvider(config: MidtransConfig): MidtransSnapProvider {
  return new MidtransSnapProvider(config);
}
