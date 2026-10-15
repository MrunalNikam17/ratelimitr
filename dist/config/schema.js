"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppConfigSchema = exports.RedisConfigSchema = exports.ServerConfigSchema = exports.RateLimitRuleSchema = exports.AlgorithmTypeSchema = void 0;
const zod_1 = require("zod");
exports.AlgorithmTypeSchema = zod_1.z.enum([
    'fixed_window',
    'sliding_window_log',
    'sliding_window_counter',
    'token_bucket',
    'leaky_bucket',
]);
exports.RateLimitRuleSchema = zod_1.z.object({
    algorithm: exports.AlgorithmTypeSchema,
    limit: zod_1.z.number().int().positive(),
    windowSec: zod_1.z.number().int().positive(),
    burst: zod_1.z.number().int().positive().optional(),
    route: zod_1.z.string().optional(),
    clientId: zod_1.z.string().optional(),
});
exports.ServerConfigSchema = zod_1.z.object({
    port: zod_1.z.number().int().positive().default(3000),
    host: zod_1.z.string().default('0.0.0.0'),
    logLevel: zod_1.z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});
exports.RedisConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    host: zod_1.z.string().default('127.0.0.1'),
    port: zod_1.z.number().int().positive().default(6379),
    password: zod_1.z.string().optional(),
    url: zod_1.z.string().optional(),
    keyPrefix: zod_1.z.string().default('ratelimit:'),
    connectTimeoutMs: zod_1.z.number().int().positive().default(5000),
});
exports.AppConfigSchema = zod_1.z.object({
    server: exports.ServerConfigSchema.default({}),
    redis: exports.RedisConfigSchema.default({}),
    failMode: zod_1.z.enum(['fail_open', 'fail_closed']).default('fail_closed'),
    defaultRule: exports.RateLimitRuleSchema.default({
        algorithm: 'token_bucket',
        limit: 60,
        windowSec: 60,
    }),
    rules: zod_1.z.array(exports.RateLimitRuleSchema).default([]),
});
//# sourceMappingURL=schema.js.map