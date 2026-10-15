"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorySlidingWindowCounterLimiter = void 0;
const base_js_1 = require("./base.js");
/**
 * Sliding Window Counter (Weighted Approximation) rate limiter.
 *
 * Approximates a sliding window by weighting the count from the previous
 * fixed window based on how far we are into the current fixed window:
 *   estimated = prevCount * (1 - (now % windowMs) / windowMs) + currentCount
 *
 * Provides smooth rate limiting without O(N) memory overhead (O(1) state).
 */
class MemorySlidingWindowCounterLimiter extends base_js_1.BaseMemoryLimiter {
    state = new Map();
    constructor(clock = new base_js_1.SystemClock()) {
        super(clock);
    }
    async check(key, rule, cost = 1) {
        const now = this.clock.now();
        const windowMs = rule.windowSec * 1000;
        const currentWindow = Math.floor(now / windowMs);
        const windowOffsetMs = now % windowMs;
        const prevWeight = Math.max(0, Math.min(1, 1 - windowOffsetMs / windowMs));
        const resetMs = Math.max(0, windowMs - windowOffsetMs);
        const resetEpochMs = now + resetMs;
        let entry = this.state.get(key);
        if (!entry) {
            entry = { currentWindow, currentCount: 0, prevCount: 0 };
            this.state.set(key, entry);
        }
        else if (currentWindow > entry.currentWindow) {
            const windowDiff = currentWindow - entry.currentWindow;
            if (windowDiff === 1) {
                entry.prevCount = entry.currentCount;
            }
            else {
                entry.prevCount = 0;
            }
            entry.currentCount = 0;
            entry.currentWindow = currentWindow;
        }
        const estimatedCount = entry.prevCount * prevWeight + entry.currentCount;
        if (estimatedCount + cost <= rule.limit) {
            entry.currentCount += cost;
            const newEstimated = estimatedCount + cost;
            const remaining = Math.max(0, Math.floor(rule.limit - newEstimated));
            return {
                allowed: true,
                limit: rule.limit,
                remaining,
                resetMs,
                resetEpochMs,
            };
        }
        const remaining = Math.max(0, Math.floor(rule.limit - estimatedCount));
        const retryAfterSec = Math.max(1, Math.ceil(resetMs / 1000));
        return {
            allowed: false,
            limit: rule.limit,
            remaining,
            resetMs,
            resetEpochMs,
            retryAfterSec,
        };
    }
    async reset(key) {
        this.state.delete(key);
    }
    async clear() {
        this.state.clear();
    }
}
exports.MemorySlidingWindowCounterLimiter = MemorySlidingWindowCounterLimiter;
//# sourceMappingURL=sliding-window-counter.js.map