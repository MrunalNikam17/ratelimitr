/**
 * Base error for ratelimitr.
 */
export declare class RateLimiterError extends Error {
    constructor(message: string);
}
/**
 * Thrown when an unsupported algorithm is requested.
 */
export declare class UnsupportedAlgorithmError extends RateLimiterError {
    constructor(algorithm: string);
}
/**
 * Thrown when Redis connection encounters a fatal failure.
 */
export declare class RedisStoreError extends RateLimiterError {
    readonly cause?: unknown;
    constructor(message: string, cause?: unknown);
}
/**
 * Thrown when configuration validation fails.
 */
export declare class ConfigurationError extends RateLimiterError {
    constructor(message: string);
}
//# sourceMappingURL=errors.d.ts.map