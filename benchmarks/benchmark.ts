import autocannon from 'autocannon';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { AlgorithmType } from '../src/core/types.js';

interface AlgorithmConfig {
  algorithm: AlgorithmType;
  route: string;
  complexity: string;
  description: string;
}

interface SingleRunResult {
  reqPerSec: number;
  totalRequests: number;
  p50: number;
  p95: number;
  p99: number;
  non2xx: number;
  errors: number;
}

interface MeasuredAlgorithmResult {
  algorithm: AlgorithmType;
  reqPerSec: number;
  totalRequests: number;
  p50: number;
  p95: number;
  p99: number;
  non2xx: number;
  errors: number;
  avgMemoryBytes: number;
  complexity: string;
  description: string;
  runs: SingleRunResult[];
}

interface SwlScalingStep {
  requests: number;
  memoryBytes: number;
  deltaBytes: number;
  avgBytesPerReq: number;
}

const DOCKER_BIN_DIR = 'C:\\Users\\mruna\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin';
const TARGET_BASE_URL = process.env['TARGET_URL'] || 'http://localhost';
const CONNECTIONS = Number(process.env['BENCHMARK_CONNECTIONS']) || 50;
const DURATION_SEC = Number(process.env['BENCHMARK_DURATION']) || 10;
const ROUNDS = Number(process.env['BENCHMARK_ROUNDS']) || 3;
const WARMUP_SEC = 3;

const ALGORITHMS: AlgorithmConfig[] = [
  {
    algorithm: 'fixed_window',
    route: '/bench/fixed-window',
    complexity: 'O(1)',
    description: 'Increments an integer counter in a single Redis key with TTL',
  },
  {
    algorithm: 'token_bucket',
    route: '/bench/token-bucket',
    complexity: 'O(1)',
    description: 'Maintains tokens and last-refill timestamp in a Redis hash with continuous replenishment',
  },
  {
    algorithm: 'leaky_bucket',
    route: '/bench/leaky-bucket',
    complexity: 'O(1)',
    description: 'Maintains water volume and last-leak timestamp in a Redis hash with constant drip rate',
  },
  {
    algorithm: 'sliding_window_counter',
    route: '/bench/sliding-window-counter',
    complexity: 'O(1)',
    description: 'Interpolates weighted counts across current and previous window buckets in a Redis hash',
  },
  {
    algorithm: 'sliding_window_log',
    route: '/bench/sliding-window-log',
    complexity: 'O(log N + M)',
    description: 'Stores individual timestamp entries in a Redis sorted set (ZSET) for exact boundary precision',
  },
];

function getExecEnv(): NodeJS.ProcessEnv {
  const currentPath = process.env['PATH'] || process.env['Path'] || '';
  return {
    ...process.env,
    PATH: currentPath.includes(DOCKER_BIN_DIR) ? currentPath : `${currentPath};${DOCKER_BIN_DIR}`,
  };
}

function runRedisCli(args: string[]): string {
  try {
    return execFileSync('docker', ['exec', 'ratelimitr-redis', 'redis-cli', ...args], {
      env: getExecEnv(),
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to execute redis-cli in ratelimitr-redis container: ${message}`);
  }
}

function flushBenchmarkKeys(): void {
  try {
    const rawKeys = runRedisCli(['--raw', 'KEYS', 'ratelimit:*:bench*']);
    const keys = rawKeys
      .split('\n')
      .map((k) => k.trim())
      .filter(Boolean);
    if (keys.length === 0) return;

    const chunkSize = 500;
    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunk = keys.slice(i, i + chunkSize);
      runRedisCli(['DEL', ...chunk]);
    }
  } catch {
    // Non-fatal if already empty
  }
}

function sampleAverageMemory(algorithm: string, sampleSize = 50): number {
  try {
    const pattern = `ratelimit:${algorithm}:bench*`;
    const rawKeys = runRedisCli(['--raw', 'KEYS', pattern]);
    const keys = rawKeys
      .split('\n')
      .map((k) => k.trim())
      .filter((k) => k && !k.endsWith(':seq'));

    if (keys.length === 0) return 0;

    const sample = keys.slice(0, sampleSize);
    let totalBytes = 0;
    let count = 0;

    for (const key of sample) {
      try {
        const out = runRedisCli(['MEMORY', 'USAGE', key]);
        const bytes = parseInt(out, 10);
        if (!isNaN(bytes) && bytes > 0) {
          totalBytes += bytes;
          count++;
        }
      } catch {
        // Skip inaccessible key
      }
    }

    return count > 0 ? Math.round(totalBytes / count) : 0;
  } catch {
    return 0;
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

async function verifyClusterHealth(baseUrl: string): Promise<void> {
  const healthUrl = `${baseUrl}/health`;
  try {
    const res = await fetch(healthUrl);
    if (!res.ok) {
      throw new Error(`Health endpoint returned status ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as { status?: string; redis?: boolean };
    if (body.status !== 'ok' || !body.redis) {
      throw new Error(`Cluster unhealthy or Redis disconnected: ${JSON.stringify(body)}`);
    }
    console.log(`✅ Cluster health check passed: connected to ${healthUrl} (Redis: healthy)`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Error: Unable to connect to ratelimitr cluster at ${healthUrl}.`);
    console.error(`   Details: ${message}`);
    console.error(`\n👉 Make sure the Docker Compose stack is running:`);
    console.error(`   $env:Path += ";${DOCKER_BIN_DIR}"`);
    console.error(`   docker compose up -d\n`);
    process.exit(1);
  }
}

async function runWarmup(baseUrl: string): Promise<void> {
  console.log(`\n🔥 Running ${WARMUP_SEC}-second warm-up phase (results discarded)...`);
  flushBenchmarkKeys();

  await autocannon({
    url: `${baseUrl}/check`,
    method: 'POST',
    connections: CONNECTIONS,
    duration: WARMUP_SEC,
    pipelining: 1,
    requests: [
      {
        method: 'POST',
        path: '/check',
        headers: {
          'content-type': 'application/json',
        },
        setupRequest: (req: any) => {
          const randomId = Math.random().toString(36).substring(2, 8);
          req.body = JSON.stringify({
            key: `bench-warmup-${randomId}`,
            route: '/bench/token-bucket',
          });
          return req;
        },
      },
    ],
  });

  flushBenchmarkKeys();
  console.log('✅ Warm-up complete. Redis buffers, TCP connections, and Node JIT primed.\n');
}

async function runAutocannonTest(
  baseUrl: string,
  config: AlgorithmConfig,
  durationSec: number,
): Promise<SingleRunResult> {
  const checkUrl = `${baseUrl}/check`;
  const routePath = config.route;
  const algName = config.algorithm;

  const instance = await autocannon({
    url: checkUrl,
    method: 'POST',
    connections: CONNECTIONS,
    duration: durationSec,
    pipelining: 1,
    requests: [
      {
        method: 'POST',
        path: '/check',
        headers: {
          'content-type': 'application/json',
        },
        setupRequest: (req: any) => {
          const randomId = Math.random().toString(36).substring(2, 10);
          req.body = JSON.stringify({
            key: `bench-${algName}-${randomId}`,
            route: routePath,
          });
          return req;
        },
      },
    ],
  });

  return {
    reqPerSec: Math.round(instance.requests.average),
    totalRequests: instance.requests.total,
    p50: instance.latency.p50,
    p95: instance.latency.p95 || instance.latency.p97_5,
    p99: instance.latency.p99,
    non2xx: instance.non2xx,
    errors: instance.errors,
  };
}

async function measureSlidingWindowLogScaling(baseUrl: string): Promise<SwlScalingStep[]> {
  console.log('\n📊 Measuring sliding_window_log Redis memory scaling across request volume on a single key...');
  const scalingKey = `bench-swl-scaling-${Date.now()}`;
  const redisKey = `ratelimit:sliding_window_log:${scalingKey}`;
  const seqKey = `${redisKey}:seq`;

  try {
    runRedisCli(['DEL', redisKey, seqKey]);
  } catch {}

  const steps = [1, 10, 25, 50, 100];
  const results: SwlScalingStep[] = [];
  let prevMemory = 0;
  let sentTotal = 0;

  for (const step of steps) {
    const toSend = step - sentTotal;
    for (let i = 0; i < toSend; i++) {
      await fetch(`${baseUrl}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: scalingKey, route: '/bench/sliding-window-log' }),
      });
    }
    sentTotal = step;

    const memStr = runRedisCli(['MEMORY', 'USAGE', redisKey]);
    const memBytes = parseInt(memStr, 10) || 0;
    const deltaBytes = prevMemory > 0 ? memBytes - prevMemory : memBytes;
    const avgBytesPerReq = Math.round((memBytes / step) * 10) / 10;

    results.push({
      requests: step,
      memoryBytes: memBytes,
      deltaBytes,
      avgBytesPerReq,
    });
    prevMemory = memBytes;
  }

  // Cleanup
  try {
    runRedisCli(['DEL', redisKey, seqKey]);
  } catch {}

  return results;
}

function generateMarkdown(
  results: MeasuredAlgorithmResult[],
  swlScaling: SwlScalingStep[],
  metadata: {
    date: string;
    targetUrl: string;
    connections: number;
    durationPerRun: number;
    rounds: number;
    warmupSec: number;
    platform: string;
    cpu: string;
    totalMemGb: string;
    nodeVersion: string;
  },
): string {
  const throughputs = results.map((r) => r.reqPerSec);
  const minThroughput = Math.min(...throughputs);
  const maxThroughput = Math.max(...throughputs);
  const throughputSpreadPercent = Math.round(((maxThroughput - minThroughput) / minThroughput) * 100);
  const isDifferenceNegligible = throughputSpreadPercent <= 15;

  const sortedByThroughput = [...results].sort((a, b) => b.reqPerSec - a.reqPerSec);
  const fastest = sortedByThroughput[0]!;
  const slowest = sortedByThroughput[sortedByThroughput.length - 1]!;

  const p50s = results.map((r) => r.p50);
  const minP50 = Math.min(...p50s);
  const maxP50 = Math.max(...p50s);

  const lines: string[] = [
    '# Rate Limiter Performance Benchmarks',
    '',
    `*Benchmark Run: ${metadata.date}*`,
    '',
    '## Test Environment & Architecture',
    '',
    `- **Target Architecture**: Live Docker Compose stack (Nginx load balancer &rarr; 3 Express cluster replicas &rarr; Redis 7)`,
    `- **Target Endpoint**: \`${metadata.targetUrl}/check\` (load-balanced through Nginx on port 80)`,
    `- **Host Operating System**: ${metadata.platform}`,
    `- **Processor**: ${metadata.cpu}`,
    `- **Total Memory**: ${metadata.totalMemGb} GB RAM`,
    `- **Node.js Version**: ${metadata.nodeVersion}`,
    `- **Warm-Up Phase**: ${metadata.warmupSec}-second discarded run to prime TCP connections, Redis buffers, and Node.js JIT`,
    `- **Benchmark Profile**: **${metadata.rounds} independent rounds** of **${metadata.durationPerRun}s per algorithm** (${metadata.rounds * metadata.durationPerRun}s total measurement per algorithm) under **${metadata.connections} concurrent connections** (pipelining = 1)`,
    '- **Order Rotation**: Algorithm evaluation order was rotated on each round to eliminate warm-cache, connection reuse, and positional bias',
    '- **Metric Aggregation**: Reported values represent the **median** of all rounds',
    `- **Key Distribution**: Generated unique distinct random keys per request via autocannon \`setupRequest\``,
    '- **Application Logging**: `LOG_LEVEL=silent` enabled during benchmark to isolate rate limiting engine throughput from console/JSON I/O bottlenecks',
    '',
    '> [!NOTE]',
    '> **Virtualization & Relative Comparison Context:**',
    '> All measurements were conducted on Docker Desktop on Windows 11 with WSL2 backend.',
    '> In this environment, WSL2 virtualization, user-mode port proxying, and virtual network bridging introduce baseline latency overhead.',
    '> Consequently, **relative performance differences across algorithms** represent the primary takeaway rather than absolute single-node Linux bare-metal throughput.',
    '',
    '## Measured Performance Across All 5 Algorithms',
    '',
    `*(Values represent the median across ${metadata.rounds} rounds of ${metadata.durationPerRun}s each, with rotated execution order)*`,
    '',
    '| Algorithm | Median Throughput (req/s) | Median p50 | Median p95 | Median p99 | Total Non-2xx | Total Socket Errors | Measured Memory / Key | Time Complexity |',
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
  ];

  for (const r of results) {
    lines.push(
      `| **\`${r.algorithm}\`** | ${r.reqPerSec.toLocaleString()} | ${r.p50} ms | ${r.p95} ms | ${r.p99} ms | ${r.non2xx} | ${r.errors} | ~${r.avgMemoryBytes} B | \`${r.complexity}\` |`,
    );
  }

  lines.push('');
  lines.push('## Memory Scaling Empirical Measurement: `sliding_window_log`');
  lines.push('');
  lines.push(
    'Unlike the constant $O(1)$ memory algorithms that store fixed hashes or integers, `sliding_window_log` stores each individual request timestamp as a member in a Redis Sorted Set (ZSET).',
  );
  lines.push(
    'Below are real measurements captured directly via `docker exec ratelimitr-redis redis-cli MEMORY USAGE <key>` on a single key under increasing request counts:',
  );
  lines.push('');
  lines.push('| Requests on Single Key | Measured Redis Memory | Delta vs Previous | Average Memory / Request |');
  lines.push('| :--- | :--- | :--- | :--- |');

  for (const step of swlScaling) {
    const deltaStr = step.deltaBytes > 0 ? `+${step.deltaBytes} B` : `${step.deltaBytes} B`;
    lines.push(
      `| **${step.requests} requests** | ${step.memoryBytes} bytes | ${deltaStr} | ${step.avgBytesPerReq} B/req |`,
    );
  }

  lines.push('');
  lines.push('## Data-Driven Empirical Analysis & Trade-Offs');
  lines.push('');
  lines.push('### 1. Throughput & Latency Evaluation');

  if (isDifferenceNegligible) {
    lines.push(
      `- **Tight Throughput Clustering (${throughputSpreadPercent}% Spread)**: Median throughput across all 5 algorithms ranged from **${minThroughput.toLocaleString()} req/s** to **${maxThroughput.toLocaleString()} req/s**, representing a minimal variance of only **${throughputSpreadPercent}%** across all tested algorithms.`,
    );
    lines.push(
      `- **Dominant System Bottlenecks**: Because throughput differences remain within ~15%, **algorithm choice has a negligible impact on overall throughput** in this setup. Overhead from Nginx reverse-proxy connection dispatching, Express JSON request parsing, and WSL2 container network virtualization dominates over the sub-millisecond differences in Redis Lua script execution.`,
    );
    lines.push(
      `- **Uniform Latency Distribution**: Median p50 latency is virtually indistinguishable across all algorithms (spanning **${minP50} ms** to **${maxP50} ms**), confirming that Redis Lua evaluation for all five algorithm types is fast enough to remain well below network round-trip thresholds.`,
    );
  } else {
    lines.push(
      `- **Throughput Variance**: Median throughput ranged from **${minThroughput.toLocaleString()} req/s** (${slowest.algorithm}) to **${maxThroughput.toLocaleString()} req/s** (${fastest.algorithm}), representing a **${throughputSpreadPercent}%** spread.`,
    );
    lines.push(
      `- **Latency Comparison**: Median p50 latency ranged from **${minP50} ms** to **${maxP50} ms**, reflecting differences in Lua state management and Redis command complexity.`,
    );
  }

  lines.push('');
  lines.push('### 2. Memory Footprint Analysis');
  const o1MemoryValues = results.filter((r) => r.algorithm !== 'sliding_window_log').map((r) => r.avgMemoryBytes);
  const minO1Mem = Math.min(...o1MemoryValues);
  const maxO1Mem = Math.max(...o1MemoryValues);

  lines.push(
    `- **Deterministic $O(1)$ Memory Usage**: The algorithms \`fixed_window\`, \`token_bucket\`, \`leaky_bucket\`, and \`sliding_window_counter\` consume a deterministic, constant amount of Redis memory per entity, empirically measured between **${minO1Mem} B** and **${maxO1Mem} B** per key. Crucially, memory consumption does not increase as a client makes more requests.`,
  );
  lines.push(
    `- **Linear $O(N)$ Growth in Sliding Window Log**: In contrast, \`sliding_window_log\` stores every individual timestamp. Real measurements demonstrate growth from **${swlScaling[0]?.memoryBytes} bytes** at 1 request to **${swlScaling[swlScaling.length - 1]?.memoryBytes} bytes** at 100 requests (~${swlScaling[swlScaling.length - 1]?.avgBytesPerReq} B/req). For high-volume services with thousands of requests per active window, this creates substantial memory bloat in Redis.`,
  );
  lines.push('');
  lines.push('### 3. Architecture & Algorithm Selection Recommendations');

  if (isDifferenceNegligible) {
    lines.push(
      'Because throughput and latency are essentially equivalent across all algorithms in this clustered deployment, **architectural decisions must be guided by behavioral semantics (burst accommodation vs. smoothing) and memory scalability**, rather than throughput numbers:',
    );
    lines.push('');
    lines.push(
      `1. **Token Bucket (Recommended General-Purpose Default)**: Ideal for standard API rate limiting. Accommodates brief traffic bursts up to the configured burst capacity, refills continuously at a steady rate, and requires minimal constant memory (~${results.find((r) => r.algorithm === 'token_bucket')?.avgMemoryBytes ?? 144} B/key).`,
    );
    lines.push(
      `2. **Fixed Window Counter (Coarse Quotas)**: Best suited for periodic coarse usage limits (e.g. daily/monthly tier quotas) where traffic spikes at window boundaries are acceptable. Yields the lowest memory overhead (~${results.find((r) => r.algorithm === 'fixed_window')?.avgMemoryBytes ?? 96} B/key).`,
    );
    lines.push(
      `3. **Sliding Window Counter (Smooth Quotas at Scale)**: Recommended when strict sliding window enforcement is required without the memory overhead of logs. Interpolates current and previous bucket weights in constant memory (~${results.find((r) => r.algorithm === 'sliding_window_counter')?.avgMemoryBytes ?? 160} B/key).`,
    );
    lines.push(
      `4. **Leaky Bucket (Egress & Downstream Protection)**: Best suited for queuing worker tasks, background jobs, or third-party API proxies where requests must be smoothed into a uniform drip rate rather than passed in bursts (~${results.find((r) => r.algorithm === 'leaky_bucket')?.avgMemoryBytes ?? 136} B/key).`,
    );
    lines.push(
      `5. **Sliding Window Log (Strict Security Checkpoints)**: Restrict strictly to sensitive, low-frequency security endpoints (e.g. login attempts, password resets, SMS verification) where 100% sliding-window precision is required and request counts per key are strictly limited. Avoid on general public endpoints due to linear $O(N)$ memory growth.`,
    );
  } else {
    lines.push(
      `1. **Highest Throughput Tier**: **\`${fastest.algorithm}\`** achieved the highest median throughput (${fastest.reqPerSec.toLocaleString()} req/s).`,
    );
    lines.push(
      `2. **General-Purpose API Rate Limiting**: **\`token_bucket\`** balances burst capacity with continuous replenishment and constant memory (~${results.find((r) => r.algorithm === 'token_bucket')?.avgMemoryBytes} B/key).`,
    );
    lines.push(
      `3. **Traffic Shaping**: **\`leaky_bucket\`** smooths bursty requests into a constant flow rate.`,
    );
    lines.push(
      `4. **Sliding Window Constraints**: **\`sliding_window_counter\`** enforces sliding boundaries with constant $O(1)$ memory.`,
    );
    lines.push(
      `5. **Security Checkpoints**: **\`sliding_window_log\`** provides exact timestamp evaluation at the cost of linear $O(N)$ memory scaling.`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

async function main(): Promise<void> {
  console.log('🚀 Starting ratelimitr benchmark against live Docker Compose stack...');
  console.log(`   Target URL: ${TARGET_BASE_URL}`);
  console.log(`   Concurrency: ${CONNECTIONS} connections | ${ROUNDS} rounds x ${DURATION_SEC}s per algorithm`);

  // Step 1: Health Check
  await verifyClusterHealth(TARGET_BASE_URL);

  // Step 2: 3-Second Warm-Up Phase (Discarded)
  await runWarmup(TARGET_BASE_URL);

  // Track runs for each algorithm
  const algorithmRuns = new Map<AlgorithmType, SingleRunResult[]>();
  const sampledMemory = new Map<AlgorithmType, number>();

  for (const alg of ALGORITHMS) {
    algorithmRuns.set(alg.algorithm, []);
  }

  // Step 3: Run Multi-Round Benchmark with Rotated Order
  for (let round = 1; round <= ROUNDS; round++) {
    // Shift algorithm order each round so no algorithm is always tested first
    const shift = (round - 1) * 2;
    const rotatedAlgorithms = [
      ...ALGORITHMS.slice(shift % ALGORITHMS.length),
      ...ALGORITHMS.slice(0, shift % ALGORITHMS.length),
    ];

    console.log(`\n============================================================`);
    console.log(`📍 Round ${round}/${ROUNDS} (Rotated Order: ${rotatedAlgorithms.map((a) => a.algorithm).join(' -> ')})`);
    console.log(`============================================================`);

    for (const config of rotatedAlgorithms) {
      console.log(`⏳ [Round ${round}] Benchmarking ${config.algorithm} (${config.route}) for ${DURATION_SEC}s...`);
      flushBenchmarkKeys();

      const stats = await runAutocannonTest(TARGET_BASE_URL, config, DURATION_SEC);
      algorithmRuns.get(config.algorithm)!.push(stats);

      // Sample memory while keys are freshly populated in Redis
      const memBytes = sampleAverageMemory(config.algorithm);
      if (memBytes > 0) {
        sampledMemory.set(config.algorithm, memBytes);
      }

      console.log(
        `   [Round ${round}] ${config.algorithm}: ${stats.reqPerSec.toLocaleString()} req/s | p50: ${stats.p50}ms | p95: ${stats.p95}ms | p99: ${stats.p99}ms | non-2xx: ${stats.non2xx} | errors: ${stats.errors} | memory: ~${memBytes} B/key`,
      );

      // Cleanup benchmark keys
      flushBenchmarkKeys();
    }
  }

  // Step 4: Compute Median Results Across Rounds
  const results: MeasuredAlgorithmResult[] = [];
  for (const config of ALGORITHMS) {
    const runs = algorithmRuns.get(config.algorithm)!;
    const medianReqPerSec = Math.round(median(runs.map((r) => r.reqPerSec)));
    const medianP50 = median(runs.map((r) => r.p50));
    const medianP95 = median(runs.map((r) => r.p95));
    const medianP99 = median(runs.map((r) => r.p99));
    const totalNon2xx = runs.reduce((acc, r) => acc + r.non2xx, 0);
    const totalErrors = runs.reduce((acc, r) => acc + r.errors, 0);
    const totalRequests = runs.reduce((acc, r) => acc + r.totalRequests, 0);
    const avgMemoryBytes = sampledMemory.get(config.algorithm) || 0;

    results.push({
      algorithm: config.algorithm,
      reqPerSec: medianReqPerSec,
      totalRequests,
      p50: medianP50,
      p95: medianP95,
      p99: medianP99,
      non2xx: totalNon2xx,
      errors: totalErrors,
      avgMemoryBytes,
      complexity: config.complexity,
      description: config.description,
      runs,
    });
  }

  // Step 5: Measure Sliding Window Log Memory Scaling
  const swlScaling = await measureSlidingWindowLogScaling(TARGET_BASE_URL);

  // Step 6: System Information
  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model ? `${cpus[0].model} (${cpus.length} logical cores)` : `${cpus.length} cores`;
  const totalMemGb = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);

  const metadata = {
    date: new Date().toISOString(),
    targetUrl: TARGET_BASE_URL,
    connections: CONNECTIONS,
    durationPerRun: DURATION_SEC,
    rounds: ROUNDS,
    warmupSec: WARMUP_SEC,
    platform: `${os.platform()} ${os.release()} (${os.arch()})`,
    cpu: cpuModel,
    totalMemGb,
    nodeVersion: process.version,
  };

  // Step 7: Generate and Write docs/benchmarks.md
  const markdown = generateMarkdown(results, swlScaling, metadata);
  const docsDir = path.resolve(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const outputPath = path.join(docsDir, 'benchmarks.md');
  fs.writeFileSync(outputPath, markdown, 'utf8');

  console.log('\n' + '='.repeat(80));
  console.log('✅ Multi-round benchmark completed successfully!');
  console.log(`📄 Results written to: ${outputPath}`);
  console.log('='.repeat(80) + '\n');
  console.log(markdown);
}

main().catch((err) => {
  console.error('\n❌ Fatal benchmark error:', err);
  process.exit(1);
});
