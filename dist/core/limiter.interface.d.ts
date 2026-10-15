import { RateLimitResult, RateLimitRule } from './types.js';
/**
 * Common RateLimiter interface implemented by all algorithms (strategy pattern)
 * and both in-memory and Redis backends.
 */
export interface RateLimiter {
    /**
     * Check if a request for the given key and rule should be allowed.
     * Consumes `cost` units (defaults to 1).
     *
     * @param key Client identifier (e.g. "ip:127.0.0.1", "apikey:user_123")
     * @param rule Rate limit configuration rule
     * @param cost Number of tokens/requests to consume (default: 1)
     * @returns RateLimitResult with allowed status, remaining quota, reset time, etc.
     */
    check(key: string, rule: RateLimitRule, cost?: number): Promise<RateLimitResult>;
    /**
     * Reset rate limit state for a key.
     * Useful for testing, administrative unblocking, and testing window boundaries.
     *
     * @param key Client identifier
     */
    reset(key: string): Promise<void>;
    /**
     * Clean up any active timers or connections.
     */
    close(): Promise<void>;
}
//# sourceMappingURL=limiter.interface.d.ts.map