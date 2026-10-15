# Architecture & Design Document: ratelimitr

## 1. System Overview

`ratelimitr` is a high-performance distributed rate limiter service and embeddable Express middleware built with TypeScript (Node.js 20), Express, and Redis. It provides atomic rate limiting across distributed server clusters using five distinct rate limiting algorithms unified behind a common Strategy Pattern interface.

```
+-----------------------------------------------------------------------+
|                             Client Layer                              |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                    Nginx Reverse Proxy / Load Balancer                |
+-----------------------------------------------------------------------+
            /                             |                            \
           v                              v                             v
+--------------------+         +--------------------+         +--------------------+
|  ratelimitr Node 1 |         |  ratelimitr Node 2 |         |  ratelimitr Node 3 |
| (Express Service)  |         | (Express Service)  |         | (Express Service)  |
+--------------------+         +--------------------+         +--------------------+
            \                             |                            /
             \                            |                           /
              v                           v                          v
+-----------------------------------------------------------------------+
|                   Redis Shared Store (EVALSHA / Lua)                  |
|          Atomic Execution - Zero Race Conditions - O(1) State         |
+-----------------------------------------------------------------------+
```

---

## 2. Algorithm Comparison & Trade-Offs

`ratelimitr` implements five distinct rate limiting algorithms, each optimized for different operational characteristics:

| Algorithm | Accuracy | Memory Overhead | Burst Handling | Computational Cost | Primary Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fixed Window Counter** | Low (Edge bursts 2x) | Minimal (~64 B / key) | Poor (boundary reset spikes) | Minimal ($O(1)$) | High-volume public API quotas |
| **Sliding Window Log** | 100% Perfect | High ($O(N)$ with limit) | Strict (no bursts allowed) | Moderate ($O(\log N + M)$) | Sensitive endpoints (Auth, MFA, Billing) |
| **Sliding Window Counter** | High (~99.5% approx.) | Minimal (~112 B / key) | Smooth (weighted boundary) | Low ($O(1)$) | High-throughput APIs requiring smooth edges |
| **Token Bucket** | High | Minimal (~88 B / key) | Excellent (configurable burst) | Low ($O(1)$) | Modern Web APIs (Stripe, GitHub, AWS) |
| **Leaky Bucket** | High | Minimal (~88 B / key) | Smooths bursts into uniform flow | Low ($O(1)$) | Egress queue rate limiting, traffic shaping |

### Detailed Algorithm Breakdown

### 2.1 Fixed Window Counter
- **Mechanism**: Divides time into static discrete windows (e.g., 00:00–01:00, 01:00–02:00). An integer counter increments per request until the limit is reached.
- **Trade-offs**:
  - *Pros*: Extremely low memory footprint (~64 bytes for a string key and TTL) and fastest execution.
  - *Cons*: Vulnerable to **boundary bursts**. A client can send $N$ requests at $t = \text{window} - 1\text{ms}$ and $N$ requests at $t = \text{window} + 1\text{ms}$, effectively transmitting $2N$ requests within a single millisecond span without triggering limits.

### 2.2 Sliding Window Log
- **Mechanism**: Maintains a sorted set of timestamps for each request made by a client. Timestamps older than `now - windowSec` are evicted via `ZREMRANGEBYSCORE`. If the cardinality (`ZCARD`) plus request cost is within the limit, new timestamps are appended (`ZADD`).
- **Trade-offs**:
  - *Pros*: Completely eliminates window boundary anomalies with 100% precision.
  - *Cons*: Memory consumption scales linearly $O(N)$ with the request volume. Storing 1,000,000 requests per minute requires megabytes of memory per client key.

### 2.3 Sliding Window Counter (Weighted Approximation)
- **Mechanism**: Combines the memory efficiency of Fixed Window with the boundary smoothing of Sliding Window Log. It calculates an estimated request count by weighting the previous window's total based on the elapsed percentage of the current window:
  $$\text{Count} = \text{Count}_{\text{prev}} \times \left(1 - \frac{\text{now} \pmod{\text{window}}}{\text{window}}\right) + \text{Count}_{\text{current}}$$
- **Trade-offs**:
  - *Pros*: $O(1)$ memory consumption (~112 bytes) while smoothing out boundary spikes.
  - *Cons*: Assumes uniform request distribution across the previous window (approximation accuracy error $< 0.5\%$).

### 2.4 Token Bucket
- **Mechanism**: A virtual bucket holds up to `capacity` (burst) tokens. Tokens refill continuously at a rate of $r = \frac{\text{limit}}{\text{windowSec}}$ tokens per millisecond. Each incoming request consumes tokens (cost). If sufficient tokens exist, the request proceeds; otherwise, it is rejected.
- **Trade-offs**:
  - *Pros*: Supports short bursts while strictly enforcing the long-term average rate. Industry standard for consumer APIs.
  - *Cons*: Requires tracking fractional token accumulation and timestamps.

### 2.5 Leaky Bucket (Traffic Shaping)
- **Mechanism**: Requests fill a bucket of capacity `burst ?? limit`. Water leaks out at a constant rate $r = \frac{\text{limit}}{\text{windowSec}}$. If the bucket overflows, requests are rejected.
- **Trade-offs**:
  - *Pros*: Enforces a strictly constant egress flow rate, protecting downstream services from spikes.
  - *Cons*: Does not permit bursts beyond the buffer capacity; bursts are queued or dropped.

---

## 3. Concurrency & Atomicity with Redis Lua Scripts

### The Read-Then-Write Race Condition
In a distributed system where multiple API gateway nodes evaluate rate limits concurrently, naïve Redis operations suffer from catastrophic race conditions:

```
Node A: GET key -> returns 9 (limit = 10)
Node B: GET key -> returns 9 (limit = 10)
Node A: SET key 10 (allowed)
Node B: SET key 10 (allowed)   <-- OVER-ALLOCATION! 11 requests admitted!
```

### The Solution: Atomic Lua Execution
Redis executes Lua scripts as single, uninterruptible atomic operations. No other client command can execute while a Lua script is active.

In `ratelimitr`:
1. All check-and-update logic occurs strictly within the Redis engine.
2. Scripts are pre-compiled and loaded into Redis script cache via `SCRIPT LOAD`.
3. Calls execute using `EVALSHA <sha1>`, transmitting only a 40-character hash instead of the complete script payload.
4. If Redis is restarted or evicts its script cache, returning `NOSCRIPT`, `LuaScriptManager` catches the exception, reloads the script, and transparently retries.

---

## 4. Resiliency & Store Failure Handling

When the central Redis instance becomes unreachable (network partition, node restart, or failover), `ratelimitr` supports configurable degraded operation modes:

### Fail-Closed Mode (`failMode: "fail_closed"`)
- **Behavior**: Rejects requests (returns HTTP 429) when Redis is down.
- **Recommended For**: Mission-critical APIs, sensitive operations (authentication, financial transactions, database-heavy mutations) where protecting downstream infrastructure from cascade failure is the top priority.

### Fail-Open Mode (`failMode: "fail_open"`)
- **Behavior**: Permits incoming requests (`allowed: true`) when Redis is down, logging warnings and incrementing error metrics.
- **Recommended For**: Read-heavy customer-facing portals, public catalogs, and media streams where user experience continuity outweighs strict quota enforcement.

### Fail-Fast Timeout Design
`ratelimitr` configures `enableOfflineQueue: false` in `ioredis`. Rather than buffering commands in memory during a network disconnect (which leads to unbounded latency spikes and memory exhaustion), the limiter fails immediately within configured timeouts (default 5,000ms), promptly invoking the fail-safe path.

---

## 5. Horizontal Scaling & Clustering Architecture

### 5.1 Redis Cluster & Hash-Tag Routing
In Redis Cluster deployments (where keys are sharded across 16,384 hash slots), multi-key commands or transactions must hash to the exact same cluster slot.

All `ratelimitr` Lua scripts are architected with **single-key routing**:
- All algorithm state is confined to `KEYS[1]`.
- For Sliding Window Log sequences, keys utilize Redis hash-tag syntax: `{ratelimit:key}` and `{ratelimit:key}:seq` hash to the identical slot.
- This guarantees full compatibility with Redis Cluster without cross-slot errors.

### 5.2 Client-Side Consistent Hashing (Ketama)
For ultra-scale deployments exceeding Redis Cluster throughput:
- Multiple standalone Redis nodes operate as independent shards.
- The application tier uses consistent hashing on `clientKey` (e.g. API key or client IP) to route requests deterministically to specific Redis shards.
- Adding or removing Redis shards affects only $\frac{1}{N}$ keys.

### 5.3 Clock Drift Synchronization
In distributed environments, server clock drift can skew rate limit windows.
- All algorithms accept timestamps (`nowMs`) passed explicitly or use server time.
- Standard NTP daemon synchronization (e.g. `chrony` or `systemd-timesyncd`) maintains cluster drift within $< 5\text{ms}$, well within rate limit tolerances.
