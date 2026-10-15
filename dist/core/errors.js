"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationError = exports.RedisStoreError = exports.UnsupportedAlgorithmError = exports.RateLimiterError = void 0;
/**
 * Base error for ratelimitr.
 */
class RateLimiterError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RateLimiterError';
    }
}
exports.RateLimiterError = RateLimiterError;
/**
 * Thrown when an unsupported algorithm is requested.
 */
class UnsupportedAlgorithmError extends RateLimiterError {
    constructor(algorithm) {
        super(`Unsupported rate limit algorithm: ${algorithm}`);
        this.name = 'UnsupportedAlgorithmError';
    }
}
exports.UnsupportedAlgorithmError = UnsupportedAlgorithmError;
/**
 * Thrown when Redis connection encounters a fatal failure.
 */
class RedisStoreError extends RateLimiterError {
    cause;
    constructor(message, cause) {
        super(message);
        this.name = 'RedisStoreError';
        this.cause = cause;
    }
}
exports.RedisStoreError = RedisStoreError;
/**
 * Thrown when configuration validation fails.
 */
class ConfigurationError extends RateLimiterError {
    constructor(message) {
        super(message);
        this.name = 'ConfigurationError';
    }
}
exports.ConfigurationError = ConfigurationError;
//# sourceMappingURL=errors.js.map