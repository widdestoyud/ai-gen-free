export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type CircuitBreakerConfig = {
  /** Provider identifier, default "siray" */
  providerId?: string;
  /** Consecutive timeouts/failures to trip circuit breaker, default 3 */
  failureThreshold?: number;
  /** Duration in OPEN state before testing HALF_OPEN in ms, default 90,000 (90s) */
  cooldownMs?: number;
  /** Duration threshold in ms for an execution to be considered slow, default 90,000 (90s) */
  slowThresholdMs?: number;
};

export type CircuitBreakerData = {
  providerId: string;
  state: CircuitBreakerState;
  consecutiveFailures: number;
  openedAt: number | null;
  cooldownUntil: number | null;
  lastFailureReason: string | null;
  lastStateChange: string;
};

export type MinimalRedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del?(key: string): Promise<unknown>;
};

export interface ICircuitBreaker {
  readonly providerId: string;
  canExecute(): Promise<{ allowed: boolean; state: CircuitBreakerState; reason?: string }>;
  recordSuccess(durationMs?: number): Promise<void>;
  recordFailure(reason: string, durationMs?: number): Promise<void>;
  getState(): Promise<CircuitBreakerData>;
  reset(): Promise<void>;
}

export class CircuitBreaker implements ICircuitBreaker {
  readonly providerId: string;
  readonly failureThreshold: number;
  readonly cooldownMs: number;
  readonly slowThresholdMs: number;

  private readonly redisClient?: MinimalRedisClient;
  private memoryData: CircuitBreakerData;

  constructor(opts: CircuitBreakerConfig & { redis?: MinimalRedisClient } = {}) {
    this.providerId = opts.providerId ?? "siray";
    this.failureThreshold = opts.failureThreshold ?? 3;
    this.cooldownMs = opts.cooldownMs ?? Number(process.env.CIRCUIT_BREAKER_COOLDOWN_MS ?? 90_000);
    this.slowThresholdMs = opts.slowThresholdMs ?? Number(process.env.CIRCUIT_BREAKER_SLOW_THRESHOLD_MS ?? 90_000);
    this.redisClient = opts.redis;
    this.memoryData = this.defaultData();
  }

  private defaultData(): CircuitBreakerData {
    return {
      providerId: this.providerId,
      state: "CLOSED",
      consecutiveFailures: 0,
      openedAt: null,
      cooldownUntil: null,
      lastFailureReason: null,
      lastStateChange: new Date().toISOString(),
    };
  }

  private redisKey(): string {
    return `circuit_breaker:${this.providerId}`;
  }

  private async load(): Promise<CircuitBreakerData> {
    if (!this.redisClient) {
      return { ...this.memoryData };
    }
    try {
      const raw = await this.redisClient.get(this.redisKey());
      if (!raw) {
        const def = this.defaultData();
        await this.redisClient.set(this.redisKey(), JSON.stringify(def));
        return def;
      }
      return JSON.parse(raw) as CircuitBreakerData;
    } catch {
      return { ...this.memoryData };
    }
  }

  private async save(data: CircuitBreakerData): Promise<void> {
    this.memoryData = { ...data };
    if (this.redisClient) {
      try {
        await this.redisClient.set(this.redisKey(), JSON.stringify(data));
      } catch (err) {
        console.error(`[CircuitBreaker] failed saving state to Redis:`, err);
      }
    }
  }

  async getState(): Promise<CircuitBreakerData> {
    const data = await this.load();
    // Check if OPEN cooldown has elapsed
    if (data.state === "OPEN" && data.openedAt) {
      const now = Date.now();
      if (now >= data.openedAt + this.cooldownMs) {
        data.state = "HALF_OPEN";
        data.cooldownUntil = null;
        data.lastStateChange = new Date().toISOString();
        await this.save(data);
      }
    }
    return data;
  }

  async canExecute(): Promise<{ allowed: boolean; state: CircuitBreakerState; reason?: string }> {
    const data = await this.load();
    const now = Date.now();

    if (data.state === "CLOSED") {
      return { allowed: true, state: "CLOSED" };
    }

    if (data.state === "OPEN") {
      const elapsed = data.openedAt ? now - data.openedAt : 0;
      if (elapsed >= this.cooldownMs) {
        // Cooldown passed, transition to HALF_OPEN to trial 1 request
        data.state = "HALF_OPEN";
        data.cooldownUntil = null;
        data.lastStateChange = new Date().toISOString();
        await this.save(data);
        return { allowed: true, state: "HALF_OPEN" };
      }
      const remainingSec = Math.ceil((this.cooldownMs - elapsed) / 1000);
      return {
        allowed: false,
        state: "OPEN",
        reason: `Server GPU sedang mengalami antrian padat (Circuit Breaker OPEN). Sisa masa proteksi: ${remainingSec} detik.`,
      };
    }

    // HALF_OPEN
    return { allowed: true, state: "HALF_OPEN" };
  }

  async recordSuccess(durationMs?: number): Promise<void> {
    const data = await this.load();
    if (data.state === "HALF_OPEN" || data.consecutiveFailures > 0) {
      data.state = "CLOSED";
      data.consecutiveFailures = 0;
      data.openedAt = null;
      data.cooldownUntil = null;
      data.lastFailureReason = null;
      data.lastStateChange = new Date().toISOString();
      await this.save(data);
    }
  }

  async recordFailure(reason: string, durationMs?: number): Promise<void> {
    const data = await this.load();
    const now = Date.now();
    data.lastFailureReason = reason;
    data.lastStateChange = new Date().toISOString();

    if (data.state === "HALF_OPEN") {
      // Trial in HALF_OPEN failed -> trip directly back to OPEN!
      data.state = "OPEN";
      data.openedAt = now;
      data.cooldownUntil = now + this.cooldownMs;
      await this.save(data);
      console.warn(`[CircuitBreaker:${this.providerId}] Trial in HALF_OPEN failed (${reason}). Tripped back to OPEN for ${this.cooldownMs / 1000}s`);
      return;
    }

    data.consecutiveFailures += 1;
    if (data.consecutiveFailures >= this.failureThreshold) {
      data.state = "OPEN";
      data.openedAt = now;
      data.cooldownUntil = now + this.cooldownMs;
      console.warn(
        `[CircuitBreaker:${this.providerId}] ${data.consecutiveFailures} consecutive failures/timeouts detected. Tripping to OPEN for ${this.cooldownMs / 1000}s. Reason: ${reason}`
      );
    }
    await this.save(data);
  }

  async reset(): Promise<void> {
    const def = this.defaultData();
    await this.save(def);
  }
}
