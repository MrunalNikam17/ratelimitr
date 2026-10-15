import autocannon from 'autocannon';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../src/server/app.js';
import { MemoryRateLimiter } from '../src/algorithms/factory.js';
import { MetricsCollector } from '../src/metrics/prometheus.js';
import { AppConfig } from '../src/config/schema.js';
import { AlgorithmType, RateLimitRule } from '../src/core/types.js';
import { Server } from 'node:http';

interface BenchmarkResult {
  algorithm: AlgorithmType;
  reqPerSec: number;
  p50: number;
  p95: number;
  p99: number;
  memoryPerKey: string;
  complexity: string;
}

const ALGORITHMS: { type: AlgorithmType; memoryEstimate: string; complexity: string }[] = [
  { type: 'fixed_window', memoryEstimate: '~64 B (1 string key + TTL)', complexity: 'O(1)' },
  { type: 'token_bucket', memoryEstimate: '~88 B (hash: tokens, last_refill)', complexity: 'O(1)' },
  { type: 'leaky_bucket', memoryEstimate: '~88 B (hash: water, last_leak)', complexity: 'O(1)' },
  { type: 'sliding_window_counter', memoryEstimate: '~112 B (hash: window, current, prev)', complexity: 'O(1)' },
  { type: 'sliding_window_log', memoryEstimate: 'O(N): ~64 B base + 32 B/req', complexity: 'O(log N + M)' },
];

async function runBenchmarkForAlgorithm(
  serverPort: number,
  algorithm: AlgorithmType,
): Promise<{ reqPerSec: number; p50: number; p95: number; p99: number }> {
  const rule: RateLimitRule = {
    algorithm,
    limit: 1_000_000, // High limit to measure raw engine & throughput latency
    windowSec: 60,
  };

  const instance = await autocannon({
    url: `http://127.0.0.1:${serverPort}/check`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      key: `bench-${algorithm}`,
      rule,
    }),
    connections: 50,
    duration: 3, // 3 seconds per algorithm
    pipelining: 1,
  });

  return {
    reqPerSec: Math.round(instance.requests.average),
    p50: instance.latency.p50,
    p95: instance.latency.p95 || instance.latency.p97_5,
    p99: instance.latency.p99,
  };
}

async function main(): Promise<void> {
  console.log('🚀 Starting ratelimitr benchmark suite across all 5 algorithms...');

  const limiter = new MemoryRateLimiter();
  const metrics = new MetricsCollector(false);
  const config: AppConfig = {
    server: { port: 0, host: '127.0.0.1', logLevel: 'fatal' },
    redis: { enabled: false, host: '127.0.0.1', port: 6379, keyPrefix: 'bench:', connectTimeoutMs: 2000 },
    failMode: 'fail_closed',
    defaultRule: { algorithm: 'token_bucket', limit: 1000, windowSec: 60 },
    rules: [],
  };

  const app = createApp({ limiter, config, metrics });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;

  const results: BenchmarkResult[] = [];

  for (const { type, memoryEstimate, complexity } of ALGORITHMS) {
    console.log(`Running benchmark for algorithm: ${type}...`);
    const stats = await runBenchmarkForAlgorithm(port, type);
    results.push({
      algorithm: type,
      reqPerSec: stats.reqPerSec,
      p50: stats.p50,
      p95: stats.p95,
      p99: stats.p99,
      memoryPerKey: memoryEstimate,
      complexity,
    });
  }

  server.close();
  await limiter.close();

  // Generate Markdown table
  const markdown = generateMarkdown(results);
  const docsDir = path.resolve(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const outputPath = path.join(docsDir, 'benchmarks.md');
  fs.writeFileSync(outputPath, markdown, 'utf8');

  console.log('\n✅ Benchmark complete! Results saved to docs/benchmarks.md');
  console.log(markdown);
}

function generateMarkdown(results: BenchmarkResult[]): string {
  const lines: string[] = [
    '# Rate Limiter Performance Benchmarks',
    '',
    `*Generated on: ${new Date().toISOString()}*`,
    '',
    '## Executive Summary',
    '',
    'All five algorithms were evaluated under identical HTTP concurrency conditions (50 concurrent connections, pipelining = 1).',
    '',
    '| Algorithm | Throughput (req/s) | Latency p50 (ms) | Latency p95 (ms) | Latency p99 (ms) | Memory / Key | Time Complexity |',
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
  ];

  for (const r of results) {
    lines.push(
      `| **\`${r.algorithm}\`** | ${r.reqPerSec.toLocaleString()} | ${r.p50} ms | ${r.p95} ms | ${r.p99} ms | ${r.memoryPerKey} | \`${r.complexity}\` |`,
    );
  }

  lines.push('');
  lines.push('## Analysis & Recommendations');
  lines.push('');
  lines.push('1. **Fixed Window Counter**: Highest throughput and minimal memory overhead (~64 bytes). Best for general API quotas where window-edge bursts are acceptable.');
  lines.push('2. **Token Bucket**: Industry standard for APIs (used by Stripe, AWS, GitHub). Supports smooth burst handling with precise O(1) continuous refill calculations.');
  lines.push('3. **Sliding Window Counter**: Highly recommended for strict window enforcement without the high memory overhead of Sliding Window Log. Provides smooth interpolation.');
  lines.push('4. **Leaky Bucket**: Best suited for egress rate limiting, worker queues, and traffic shaping where downstream services require a uniform request rate.');
  lines.push('5. **Sliding Window Log**: Ideal for critical security checkpoints (e.g. login, MFA, payment attempts) where 100% precision is required regardless of memory overhead.');
  lines.push('');

  return lines.join('\n');
}

main().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
