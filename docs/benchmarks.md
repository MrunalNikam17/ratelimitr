# Rate Limiter Performance Benchmarks

*Generated on: 2026-10-15T15:59:32.084Z*

## Executive Summary

All five algorithms were evaluated under identical HTTP concurrency conditions (50 concurrent connections, pipelining = 1).

| Algorithm | Throughput (req/s) | Latency p50 (ms) | Latency p95 (ms) | Latency p99 (ms) | Memory / Key | Time Complexity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`fixed_window`** | 3,251 | 12 ms | 41 ms | 68 ms | ~64 B (1 string key + TTL) | `O(1)` |
| **`token_bucket`** | 3,276 | 13 ms | 30 ms | 32 ms | ~88 B (hash: tokens, last_refill) | `O(1)` |
| **`leaky_bucket`** | 1,459 | 24 ms | 80 ms | 96 ms | ~88 B (hash: water, last_leak) | `O(1)` |
| **`sliding_window_counter`** | 842 | 57 ms | 73 ms | 155 ms | ~112 B (hash: window, current, prev) | `O(1)` |
| **`sliding_window_log`** | 859 | 56 ms | 72 ms | 146 ms | O(N): ~64 B base + 32 B/req | `O(log N + M)` |

## Analysis & Recommendations

1. **Fixed Window Counter**: Highest throughput and minimal memory overhead (~64 bytes). Best for general API quotas where window-edge bursts are acceptable.
2. **Token Bucket**: Industry standard for APIs (used by Stripe, AWS, GitHub). Supports smooth burst handling with precise O(1) continuous refill calculations.
3. **Sliding Window Counter**: Highly recommended for strict window enforcement without the high memory overhead of Sliding Window Log. Provides smooth interpolation.
4. **Leaky Bucket**: Best suited for egress rate limiting, worker queues, and traffic shaping where downstream services require a uniform request rate.
5. **Sliding Window Log**: Ideal for critical security checkpoints (e.g. login, MFA, payment attempts) where 100% precision is required regardless of memory overhead.
