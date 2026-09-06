export class RetryableProviderError extends Error {
  readonly retryable = true as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RetryableProviderError";
  }
}

export class TerminalProviderError extends Error {
  readonly retryable = false as const;

  constructor(
    public readonly errorCode: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "TerminalProviderError";
  }
}

export function isRetryableProviderError(err: unknown): err is RetryableProviderError {
  return err instanceof RetryableProviderError;
}

export function isTerminalProviderError(err: unknown): err is TerminalProviderError {
  return err instanceof TerminalProviderError;
}
