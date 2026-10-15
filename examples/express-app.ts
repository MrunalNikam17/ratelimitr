/**
 * Example Express application demonstrating ratelimitr middleware usage.
 * Run with: npx tsx examples/express-app.ts
 */
import express from 'express';
import {
  createRateLimitMiddleware,
  MemoryRateLimiter,
  apiKeyOrIpGenerator,
  RateLimitRule,
} from '../src/index.js';

const app = express();
app.use(express.json());

// Initialize in-memory rate limiter (or use RedisRateLimiter for distributed setup)
const limiter = new MemoryRateLimiter();

// Example 1: Global rate limiter applied to all routes (Token Bucket, 100 req / min)
app.use(
  createRateLimitMiddleware({
    limiter,
    rule: {
      algorithm: 'token_bucket',
      limit: 100,
      windowSec: 60,
      burst: 20,
    },
    keyGenerator: apiKeyOrIpGenerator,
  }),
);

// Example 2: Strict rate limit on sensitive login endpoint (Sliding Window Log: 5 attempts per 60s)
const loginLimiterRule: RateLimitRule = {
  algorithm: 'sliding_window_log',
  limit: 5,
  windowSec: 60,
};

app.post(
  '/api/login',
  createRateLimitMiddleware({
    limiter,
    rule: loginLimiterRule,
  }),
  (req, res) => {
    res.json({ message: 'Login successful' });
  },
);

// Example 3: Search endpoint with weighted cost per query length
app.get(
  '/api/search',
  createRateLimitMiddleware({
    limiter,
    rule: {
      algorithm: 'token_bucket',
      limit: 30,
      windowSec: 60,
    },
    cost: (req) => {
      const query = (req.query['q'] as string) || '';
      return query.length > 20 ? 3 : 1;
    },
  }),
  (req, res) => {
    res.json({ results: [`Result for query: ${req.query['q']}`] });
  },
);

// Example 4: Heavy background report generation shaped with Leaky Bucket
app.get(
  '/api/reports',
  createRateLimitMiddleware({
    limiter,
    rule: {
      algorithm: 'leaky_bucket',
      limit: 10,
      windowSec: 30,
    },
  }),
  (_req, res) => {
    res.json({ report: 'Annual Financial Summary 2026' });
  },
);

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Example service running on http://localhost:${PORT}`);
  console.log('Try testing with curl:');
  console.log(`  curl -i -X POST http://localhost:${PORT}/api/login`);
  console.log(`  curl -i http://localhost:${PORT}/api/search?q=typescript`);
});
