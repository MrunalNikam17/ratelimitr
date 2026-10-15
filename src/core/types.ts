/**
 * Supported rate limiting algorithm types.
 */
export type AlgorithmType =
  | 'fixed_window'
  | 'sliding_window_log'
  | 'sliding_window_counter'
  | 'token_bucket'
  | 'leaky_bucket';

/**
 * Configuration rule defining the rate limit parameters.
 */
export interface RateLimitRule {
  /** The algorithm strategy to apply */
  algorithm: AlgorithmType;
  /** Maximum number of allowed requests/tokens within windowSec */
  limit: number;
  /** Duration of the rate limit window in seconds */
  windowSec: number;
  /** Maximum burst capacity (applies primarily to token bucket) */
  burst?: number;
  /** Route pattern if rule is route-bound (e.g. "/api/search") */
  route?: string;
  /** Client identifier or tier if rule is client-bound */
  clientId?: string;
}

/**
 * Result returned by a RateLimiter check operation.
 */
export interface RateLimitResult {
  /** Whether the request is permitted */
  allowed: boolean;
  /** Configured limit for this rule */
  limit: number;
  /** Number of remaining requests/tokens allowed */
  remaining: number;
  /** Milliseconds until window resets or next token/slot is available */
  resetMs: number;
  /** Unix epoch timestamp (ms) when reset occurs */
  resetEpochMs: number;
  /** Seconds to wait before retrying (defined if allowed is false) */
  retryAfterSec?: number;
}

/**
 * Behavior when the underlying store (e.g. Redis) is unavailable.
 */
export type FailMode = 'fail_open' | 'fail_closed';

/**
 * Global rate limiter options.
 */
export interface LimiterOptions {
  /** Fail open (allow requests) or fail closed (block requests) on store failure */
  failMode: FailMode;
  /** Optional key prefix for Redis keys */
  keyPrefix?: string;
  /** Timeout in ms for store operations */
  timeoutMs?: number;
}
