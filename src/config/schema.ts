import { z } from 'zod';

export const AlgorithmTypeSchema = z.enum([
  'fixed_window',
  'sliding_window_log',
  'sliding_window_counter',
  'token_bucket',
  'leaky_bucket',
]);

export const RateLimitRuleSchema = z.object({
  algorithm: AlgorithmTypeSchema,
  limit: z.number().int().positive(),
  windowSec: z.number().int().positive(),
  burst: z.number().int().positive().optional(),
  route: z.string().optional(),
  clientId: z.string().optional(),
});

export const ServerConfigSchema = z.object({
  port: z.number().int().positive().default(3000),
  host: z.string().default('0.0.0.0'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export const RedisConfigSchema = z.object({
  enabled: z.boolean().default(false),
  host: z.string().default('127.0.0.1'),
  port: z.number().int().positive().default(6379),
  password: z.string().optional(),
  url: z.string().optional(),
  keyPrefix: z.string().default('ratelimit:'),
  connectTimeoutMs: z.number().int().positive().default(5000),
});

export const AppConfigSchema = z.object({
  server: ServerConfigSchema.default({}),
  redis: RedisConfigSchema.default({}),
  failMode: z.enum(['fail_open', 'fail_closed']).default('fail_closed'),
  defaultRule: RateLimitRuleSchema.default({
    algorithm: 'token_bucket',
    limit: 60,
    windowSec: 60,
  }),
  rules: z.array(RateLimitRuleSchema).default([]),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
