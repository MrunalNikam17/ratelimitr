/**
 * Base error for ratelimitr.
 */
export class RateLimiterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimiterError';
  }
}

/**
 * Thrown when an unsupported algorithm is requested.
 */
export class UnsupportedAlgorithmError extends RateLimiterError {
  constructor(algorithm: string) {
    super(`Unsupported rate limit algorithm: ${algorithm}`);
    this.name = 'UnsupportedAlgorithmError';
  }
}

/**
 * Thrown when Redis connection encounters a fatal failure.
 */
export class RedisStoreError extends RateLimiterError {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'RedisStoreError';
    this.cause = cause;
  }
}

/**
 * Thrown when configuration validation fails.
 */
export class ConfigurationError extends RateLimiterError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
