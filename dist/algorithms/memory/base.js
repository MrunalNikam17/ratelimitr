"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseMemoryLimiter = exports.SystemClock = void 0;
class SystemClock {
    now() {
        return Date.now();
    }
}
exports.SystemClock = SystemClock;
/**
 * Base abstract class for in-memory rate limiting algorithms.
 * Supports clock injection for precise testing of time windows,
 * burst conditions, and clock drift.
 */
class BaseMemoryLimiter {
    clock;
    constructor(clock = new SystemClock()) {
        this.clock = clock;
    }
    async close() {
        // In-memory limiters by default have no persistent network handles
        return Promise.resolve();
    }
}
exports.BaseMemoryLimiter = BaseMemoryLimiter;
//# sourceMappingURL=base.js.map