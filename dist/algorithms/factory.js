"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryRateLimiter = void 0;
const errors_js_1 = require("../core/errors.js");
const base_js_1 = require("./memory/base.js");
const fixed_window_js_1 = require("./memory/fixed-window.js");
const token_bucket_js_1 = require("./memory/token-bucket.js");
const sliding_window_log_js_1 = require("./memory/sliding-window-log.js");
const sliding_window_counter_js_1 = require("./memory/sliding-window-counter.js");
const leaky_bucket_js_1 = require("./memory/leaky-bucket.js");
/**
 * Composite in-memory rate limiter using the Strategy Pattern.
 * Automatically delegates to the appropriate algorithm implementation
 * based on the rule configuration.
 */
class MemoryRateLimiter {
    strategies;
    constructor(clock = new base_js_1.SystemClock()) {
        this.strategies = new Map([
            ['fixed_window', new fixed_window_js_1.MemoryFixedWindowLimiter(clock)],
            ['token_bucket', new token_bucket_js_1.MemoryTokenBucketLimiter(clock)],
            ['sliding_window_log', new sliding_window_log_js_1.MemorySlidingWindowLogLimiter(clock)],
            ['sliding_window_counter', new sliding_window_counter_js_1.MemorySlidingWindowCounterLimiter(clock)],
            ['leaky_bucket', new leaky_bucket_js_1.MemoryLeakyBucketLimiter(clock)],
        ]);
    }
    getStrategy(algorithm) {
        const strategy = this.strategies.get(algorithm);
        if (!strategy) {
            throw new errors_js_1.UnsupportedAlgorithmError(algorithm);
        }
        return strategy;
    }
    async check(key, rule, cost = 1) {
        const strategy = this.getStrategy(rule.algorithm);
        return strategy.check(key, rule, cost);
    }
    async reset(key) {
        for (const strategy of this.strategies.values()) {
            await strategy.reset(key);
        }
    }
    async close() {
        for (const strategy of this.strategies.values()) {
            await strategy.close();
        }
    }
}
exports.MemoryRateLimiter = MemoryRateLimiter;
//# sourceMappingURL=factory.js.map