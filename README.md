# ratelimitr ⚡

[![CI](https://github.com/ratelimitr/ratelimitr/actions/workflows/ci.yml/badge.svg)](https://github.com/ratelimitr/ratelimitr/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org)
[![Coverage](https://img.shields.io/badge/Coverage-95%2B%25-brightgreen.svg)]()

A high-performance, distributed rate limiter service and embeddable Express middleware built with **TypeScript (Node.js 20)**, **Express**, and **Redis**. Designed for extreme concurrency, strict correctness across multi-instance clusters, and flexible traffic management.

---

## Architecture

```mermaid
graph TD
    Client[Client Applications] --> Nginx[Nginx Reverse Proxy / Load Balancer]
    Nginx --> App1[ratelimitr Instance 1]
    Nginx --> App2[ratelimitr Instance 2]
    Nginx --> App3[ratelimitr Instance 3]
    
    App1 --> Redis[(Redis Cluster / Master)]
    App2 --> Redis
    App3 --> Redis
    
    subgraph "Atomic Execution Engine"
        Redis --- Lua["Lua Scripts (EVALSHA)<br/>• Atomic Check & Update<br/>• Zero Race Conditions"]
    end
    
    subgraph "Algorithm Strategies"
        Alg1["Fixed Window Counter"]
        Alg2["Sliding Window Log"]
        Alg3["Sliding Window Counter"]
        Alg4["Token Bucket"]
        Alg5["Leaky Bucket"]
    end
```

---

## Key Features

- **5 Rate Limiting Algorithms**:
  1. **Fixed Window Counter**: Fast, low memory ($O(1)$).
  2. **Sliding Window Log**: 100% precision timestamp tracking.
  3. **Sliding Window Counter**: Smooth weighted approximation ($O(1)$ memory).
  4. **Token Bucket**: Industry standard burst handling with continuous refill.
  5. **Leaky Bucket**: Constant egress rate traffic shaping.
- **Strict Distributed Concurrency**: All check-and-update operations run as atomic Lua scripts using `EVALSHA`, eliminating read-then-write race conditions.
- **In-Memory Fallback**: Pure in-memory implementations for unit tests and local execution without Redis.
- **Standard RFC Headers**: Automatically outputs `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` (with HTTP 429).
- **Store Resiliency**: Configurable **fail-open** or **fail-closed** behavior when Redis is unavailable.
- **Rule Hierarchy**: Flexible route and client-tier configuration via YAML or JSON.
- **Observability**: Prometheus metrics export (`/metrics`) and structured JSON logging (`pino`).

---

## Quick Start

### 1. Run with Docker Compose (3 Replicas + Nginx + Redis)
Start the complete 3-instance load-balanced cluster with one command:

```bash
docker compose up --build -d
```

Test the cluster:
```bash
curl -i http://localhost/health
```

### 2. Local Development

```bash
# Clone and install dependencies
git clone https://github.com/ratelimitr/ratelimitr.git
cd ratelimitr
npm install

# Start local dev server (auto-reloads on file change)
npm run dev

# Run full test suite with coverage
npm run test:coverage

# Run benchmark suite
npm run benchmark
```

---

## Dashboard (ratelimitr Playground)

An interactive, developer-focused visualization dashboard built with **React**, **TypeScript**, **Tailwind CSS**, and **Recharts** to demonstrate distributed rate limiting dynamics in 30 seconds.

![Boundary Burst Algorithm Comparison](docs/boundary-burst.gif)

### Core Sections

1. **Interactive Playground**:
   - Live quota consumption gauge, RFC header inspector (`X-RateLimit-Limit`, `Remaining`, `Reset`, `Retry-After`), and millisecond-accurate countdown timer.
   - Dispatch single requests, burst batches (up to 500 requests), or stream continuous traffic at target rates (up to 50 req/s).
   - Real-time request timeline stream distinguishing allowed ($200\text{ OK}$) and rate-limited ($429\text{ Too Many Requests}$) events.

2. **Algorithm Comparison & Boundary Exploit Analysis**:
   - Runs concurrent traffic against all 5 algorithms simultaneously with isolated keys.
   - **Window-Boundary Burst Demonstration**: Calculates exact epoch window boundaries (`Date.now() % windowMs`) and fires bursts right before and after boundary transitions. Visibly demonstrates why naive **Fixed Window Counter** admits $\sim 2\times$ the limit across boundaries while **Sliding Window Log**, **Sliding Window Counter**, **Token Bucket**, and **Leaky Bucket** enforce strict limits.
   - Small-multiple Recharts area/bar charts displaying admitted vs blocked requests per second with algorithm-specific behavioral notes.

3. **Cluster Observability & Metrics**:
   - Real-time polling of `/health` and Prometheus text exposition (`/metrics`).
   - Cluster storage engine status (Redis cluster vs in-memory fallback) and node uptime.
   - Linear interpolation of Prometheus histogram buckets (`ratelimit_duration_seconds_bucket`) estimating **p50** and **p95** check latencies.
   - Comprehensive throughput breakdown (allowed vs blocked) per algorithm and store error tracking (`ratelimit_store_errors_total`).

<div align="center">
  <img src="docs/dashboard-playground.png" alt="ratelimitr Playground" width="48%" />
  <img src="docs/dashboard-status.png" alt="Cluster Observability" width="48%" />
</div>

### Running the Dashboard

#### 1. Local Development (with Vite Proxy)
Ensure the `ratelimitr` backend is running on `http://localhost:3000`. Then launch the dashboard:

```bash
cd dashboard
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite development server automatically proxies API requests (`/check`, `/health`, `/metrics`) to the Express backend without requiring CORS.

#### 2. Production Docker & Nginx
When running via Docker Compose (`docker compose up --build -d`), the dashboard can be built and mounted directly into Nginx:

```bash
cd dashboard && npm run build && cd ..
docker compose up -d nginx
```

The production dashboard is served at `http://localhost/ui/`.

---

Configure `ratelimitr` via `config/default.yaml` or environment variables:

```yaml
server:
  port: 3000
  host: "0.0.0.0"
  logLevel: "info"

redis:
  enabled: true
  host: "127.0.0.1"
  port: 6379
  keyPrefix: "ratelimit:"
  connectTimeoutMs: 5000

failMode: "fail_closed" # Options: fail_open | fail_closed

defaultRule:
  algorithm: "token_bucket"
  limit: 100
  windowSec: 60
  burst: 20

rules:
  - route: "/api/search"
    algorithm: "token_bucket"
    limit: 100
    windowSec: 60
    burst: 20

  - route: "/api/login"
    algorithm: "sliding_window_log"
    limit: 5
    windowSec: 60

  - route: "/api/reports"
    algorithm: "leaky_bucket"
    limit: 10
    windowSec: 30

  - clientId: "tier_premium"
    algorithm: "token_bucket"
    limit: 1000
    windowSec: 60
    burst: 200
```

### Environment Variable Overrides

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP service port |
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_URL` | - | Redis connection URL (e.g. `redis://user:pass@host:6379`) |
| `FAIL_MODE` | `fail_closed` | Resiliency strategy: `fail_open` or `fail_closed` |
| `CONFIG_PATH` | `config/default.yaml` | Path to custom YAML/JSON config file |
| `LOG_LEVEL` | `info` | Structured logging level (`debug`, `info`, `warn`, `error`) |

---

## API Endpoints & `curl` Examples

### 1. `POST /check`
Evaluate and consume quota for a client key and rule.

```bash
# Check using default rule
curl -i -X POST http://localhost:3000/check \
  -H "Content-Type: application/json" \
  -d '{"key": "user_123"}'

# Check against a specific route rule
curl -i -X POST http://localhost:3000/check \
  -H "Content-Type: application/json" \
  -d '{"key": "user_123", "route": "/api/search"}'

# Check with an explicit rule override and multi-cost consumption
curl -i -X POST http://localhost:3000/check \
  -H "Content-Type: application/json" \
  -d '{
    "key": "user_123",
    "cost": 2,
    "rule": {
      "algorithm": "token_bucket",
      "limit": 50,
      "windowSec": 60,
      "burst": 10
    }
  }'
```

#### Response (Allowed - HTTP 200):
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1773595200
Content-Type: application/json

{
  "allowed": true,
  "limit": 10,
  "remaining": 8,
  "resetMs": 59120,
  "resetEpochMs": 1773595200000
}
```

#### Response (Rate Limit Exceeded - HTTP 429):
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1773595200
Retry-After: 15
Content-Type: application/json

{
  "allowed": false,
  "limit": 10,
  "remaining": 0,
  "resetMs": 14800,
  "resetEpochMs": 1773595200000,
  "retryAfterSec": 15
}
```

### 2. `GET /health`
Liveness and store readiness probe.

```bash
curl -i http://localhost:3000/health
```

```json
{
  "status": "ok",
  "redis": true,
  "uptime": 1420,
  "timestamp": "2026-10-15T10:15:00.000Z"
}
```

### 3. `GET /metrics`
Prometheus metrics endpoint.

```bash
curl -i http://localhost:3000/metrics
```

---

## Embeddable Express Middleware

Embed `ratelimitr` directly into any Express application:

```typescript
import express from 'express';
import {
  createRateLimitMiddleware,
  MemoryRateLimiter, // Or RedisRateLimiter for clusters
  apiKeyOrIpGenerator,
} from 'ratelimitr';

const app = express();
const limiter = new MemoryRateLimiter();

// Apply global rate limiting
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

// Route-specific rate limit
app.post(
  '/api/login',
  createRateLimitMiddleware({
    limiter,
    rule: {
      algorithm: 'sliding_window_log',
      limit: 5,
      windowSec: 60,
    },
  }),
  (req, res) => res.json({ message: 'Login OK' }),
);

app.listen(3000);
```

---

## Performance Benchmarks

*Evaluated with 50 concurrent connections, pipelining = 1 (Source: [`docs/benchmarks.md`](docs/benchmarks.md)):*

| Algorithm | Throughput (req/s) | Latency p50 | Latency p95 | Latency p99 | Memory / Key | Complexity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`token_bucket`** | **3,276 req/s** | **13 ms** | **30 ms** | **32 ms** | ~88 B | $O(1)$ |
| **`fixed_window`** | **3,251 req/s** | **12 ms** | **41 ms** | **68 ms** | ~64 B | $O(1)$ |
| **`leaky_bucket`** | **1,459 req/s** | **24 ms** | **80 ms** | **96 ms** | ~88 B | $O(1)$ |
| **`sliding_window_log`** | **859 req/s** | **56 ms** | **72 ms** | **146 ms** | $O(N)$ | $O(\log N + M)$ |
| **`sliding_window_counter`** | **842 req/s** | **57 ms** | **73 ms** | **155 ms** | ~112 B | $O(1)$ |

---

## Testing & Quality Assurance

```bash
# Unit, Integration, and Concurrency Tests (with coverage report)
npm run test:coverage

# Linting
npm run lint

# TypeScript Compilation
npm run build
```

- **Unit tests**: Cover all 5 algorithms, boundary intervals, fractional refills, clock drift, and custom costs.
- **Concurrency test**: Fires 1,000 parallel requests across 3 server instances against a shared rate limiter and asserts the limit is strictly respected.
- **Test Coverage**: Exceeds **95%** statement and line coverage.

---

## License

MIT © ratelimitr contributors.
