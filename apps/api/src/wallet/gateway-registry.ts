import type {
  PaymentGatewayDriver,
  PaymentGatewayPort,
  GatewayFrontendConfig,
  PaymentGatewayRegistry,
} from "@ai-gen-free/core";

export class DefaultPaymentGatewayRegistry implements PaymentGatewayRegistry {
  private gateways = new Map<PaymentGatewayDriver, PaymentGatewayPort>();
  private frontendConfigs = new Map<PaymentGatewayDriver, GatewayFrontendConfig>();
  private defaultDriver: PaymentGatewayDriver | null = null;

  register(
    driver: PaymentGatewayDriver,
    gateway: PaymentGatewayPort,
    frontendConfig: GatewayFrontendConfig,
    isDefault: boolean = false
  ): void {
    this.gateways.set(driver, gateway);
    this.frontendConfigs.set(driver, frontendConfig);
    if (isDefault || !this.defaultDriver) {
      this.defaultDriver = driver;
    }
  }

  getDefault(): PaymentGatewayPort | null {
    if (!this.defaultDriver) return null;
    return this.gateways.get(this.defaultDriver) ?? null;
  }

  get(driver: PaymentGatewayDriver): PaymentGatewayPort | null {
    return this.gateways.get(driver) ?? null;
  }

  list(): Array<{ driver: PaymentGatewayDriver; provider: string; enabled: boolean }> {
    const result = [];
    for (const [driver, config] of this.frontendConfigs.entries()) {
      result.push({
        driver,
        provider: config.provider,
        enabled: true,
      });
    }
    return result;
  }

  getFrontendConfig(driver: PaymentGatewayDriver): GatewayFrontendConfig | null {
    return this.frontendConfigs.get(driver) ?? null;
  }
}
