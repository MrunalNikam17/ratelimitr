# Rate Limiter Performance Benchmarks

*Benchmark Run: 2026-10-18T14:52:00.822Z*

## Test Environment & Architecture

- **Target Architecture**: Live Docker Compose stack (Nginx load balancer &rarr; 3 Express cluster replicas &rarr; Redis 7)
- **Target Endpoint**: `http://localhost/check` (load-balanced through Nginx on port 80)
- **Host Operating System**: win32 10.0.26100 (x64)
- **Processor**: 12th Gen Intel(R) Core(TM) i5-1240P (16 logical cores)
- **Total Memory**: 15.7 GB RAM
- **Node.js Version**: v20.19.6
- **Warm-Up Phase**: 3-second discarded run to prime TCP connections, Redis buffers, and Node.js JIT
- **Benchmark Profile**: **3 independent rounds** of **10s per algorithm** (30s total measurement per algorithm) under **50 concurrent connections** (pipelining = 1)
- **Order Rotation**: Algorithm evaluation order was rotated on each round to eliminate warm-cache, connection reuse, and positional bias
- **Metric Aggregation**: Reported values represent the **median** of all rounds
- **Key Distribution**: Generated unique distinct random keys per request via autocannon `setupRequest`
- **Application Logging**: `LOG_LEVEL=silent` enabled during benchmark to isolate rate limiting engine throughput from console/JSON I/O bottlenecks

> [!NOTE]
> **Virtualization & Relative Comparison Context:**
> All measurements were conducted on Docker Desktop on Windows 11 with WSL2 backend.
> In this environment, WSL2 virtualization, user-mode port proxying, and virtual network bridging introduce baseline latency overhead.
> Consequently, **relative performance differences across algorithms** represent the primary takeaway rather than absolute single-node Linux bare-metal throughput.

## Measured Performance Across All 5 Algorithms

*(Values represent the median across 3 rounds of 10s each, with rotated execution order)*

| Algorithm | Median Throughput (req/s) | Median p50 | Median p95 | Median p99 | Total Non-2xx | Total Socket Errors | Measured Memory / Key | Time Complexity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`fixed_window`** | 2,973 | 15 ms | 28 ms | 32 ms | 0 | 0 | ~96 B | `O(1)` |
| **`token_bucket`** | 3,193 | 14 ms | 25 ms | 30 ms | 0 | 0 | ~144 B | `O(1)` |
| **`leaky_bucket`** | 2,769 | 17 ms | 30 ms | 36 ms | 0 | 0 | ~136 B | `O(1)` |
| **`sliding_window_counter`** | 2,227 | 20 ms | 41 ms | 51 ms | 0 | 0 | ~160 B | `O(1)` |
| **`sliding_window_log`** | 2,889 | 16 ms | 29 ms | 34 ms | 0 | 0 | ~160 B | `O(log N + M)` |

## Memory Scaling Empirical Measurement: `sliding_window_log`

Unlike the constant $O(1)$ memory algorithms that store fixed hashes or integers, `sliding_window_log` stores each individual request timestamp as a member in a Redis Sorted Set (ZSET).
Below are real measurements captured directly via `docker exec ratelimitr-redis redis-cli MEMORY USAGE <key>` on a single key under increasing request counts:

| Requests on Single Key | Measured Redis Memory | Delta vs Previous | Average Memory / Request |
| :--- | :--- | :--- | :--- |
| **1 requests** | 144 bytes | +144 B | 144 B/req |
| **10 requests** | 424 bytes | +280 B | 42.4 B/req |
| **25 requests** | 872 bytes | +448 B | 34.9 B/req |
| **50 requests** | 1640 bytes | +768 B | 32.8 B/req |
| **100 requests** | 3176 bytes | +1536 B | 31.8 B/req |

## Data-Driven Empirical Analysis & Trade-Offs

### 1. Throughput & Latency Evaluation
- **Throughput Variance**: Median throughput ranged from **2,227 req/s** (sliding_window_counter) to **3,193 req/s** (token_bucket), representing a **43%** spread.
- **Latency Comparison**: Median p50 latency ranged from **14 ms** to **20 ms**, reflecting differences in Lua state management and Redis command complexity.

### 2. Memory Footprint Analysis
- **Deterministic $O(1)$ Memory Usage**: The algorithms `fixed_window`, `token_bucket`, `leaky_bucket`, and `sliding_window_counter` consume a deterministic, constant amount of Redis memory per entity, empirically measured between **96 B** and **160 B** per key. Crucially, memory consumption does not increase as a client makes more requests.
- **Linear $O(N)$ Growth in Sliding Window Log**: In contrast, `sliding_window_log` stores every individual timestamp. Real measurements demonstrate growth from **144 bytes** at 1 request to **3176 bytes** at 100 requests (~31.8 B/req). For high-volume services with thousands of requests per active window, this creates substantial memory bloat in Redis.

### 3. Architecture & Algorithm Selection Recommendations
1. **Highest Throughput Tier**: **`token_bucket`** achieved the highest median throughput (3,193 req/s).
2. **General-Purpose API Rate Limiting**: **`token_bucket`** balances burst capacity with continuous replenishment and constant memory (~144 B/key).
3. **Traffic Shaping**: **`leaky_bucket`** smooths bursty requests into a constant flow rate.
4. **Sliding Window Constraints**: **`sliding_window_counter`** enforces sliding boundaries with constant $O(1)$ memory.
5. **Security Checkpoints**: **`sliding_window_log`** provides exact timestamp evaluation at the cost of linear $O(N)$ memory scaling.
