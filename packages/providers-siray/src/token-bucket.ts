/** Token bucket: default 1 rps, burst 3. Empty bucket → caller must retry (not fail the job). */
export class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;

  constructor(
    private readonly opts: {
      ratePerSec?: number;
      burst?: number;
      now?: () => number;
    } = {},
  ) {
    this.tokens = this.burst;
    this.lastRefillMs = this.now();
  }

  get ratePerSec(): number {
    return this.opts.ratePerSec ?? 1;
  }

  get burst(): number {
    return this.opts.burst ?? 3;
  }

  take(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private refill(): void {
    const now = this.now();
    const elapsedSec = Math.max(0, now - this.lastRefillMs) / 1000;
    this.tokens = Math.min(this.burst, this.tokens + elapsedSec * this.ratePerSec);
    this.lastRefillMs = now;
  }
}
