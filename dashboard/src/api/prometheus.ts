import { AlgorithmType, SystemMetrics, LatencyPercentiles } from '../types';

interface Bucket {
  le: number;
  count: number;
}

export function parsePrometheusMetrics(text: string): SystemMetrics {
  const lines = text.split('\n');

  const algorithmStats: Record<AlgorithmType, { allowed: number; blocked: number }> = {
    fixed_window: { allowed: 0, blocked: 0 },
    sliding_window_log: { allowed: 0, blocked: 0 },
    sliding_window_counter: { allowed: 0, blocked: 0 },
    token_bucket: { allowed: 0, blocked: 0 },
    leaky_bucket: { allowed: 0, blocked: 0 },
  };

  const overallBuckets: Map<number, number> = new Map();
  let overallCount = 0;

  const algoBuckets: Record<AlgorithmType, Map<number, number>> = {
    fixed_window: new Map(),
    sliding_window_log: new Map(),
    sliding_window_counter: new Map(),
    token_bucket: new Map(),
    leaky_bucket: new Map(),
  };
  const algoCount: Record<AlgorithmType, number> = {
    fixed_window: 0,
    sliding_window_log: 0,
    sliding_window_counter: 0,
    token_bucket: 0,
    leaky_bucket: 0,
  };

  let storeErrorsTotal = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Match metric line: name{labels} value or name value
    const match = trimmed.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s*(?:\{([^}]*)\})?\s+([0-9.eE+-]+)/);
    if (!match) continue;

    const [, metricName, labelStr, valueStr] = match;
    const value = parseFloat(valueStr);
    if (isNaN(value)) continue;

    const labels: Record<string, string> = {};
    if (labelStr) {
      const labelPairs = labelStr.match(/([a-zA-Z_0-9]+)="([^"]*)"/g);
      if (labelPairs) {
        for (const pair of labelPairs) {
          const eqIdx = pair.indexOf('=');
          const k = pair.slice(0, eqIdx);
          const v = pair.slice(eqIdx + 2, -1);
          labels[k] = v;
        }
      }
    }

    // 1. ratelimit_requests_total
    if (metricName === 'ratelimit_requests_total') {
      const algo = labels['algorithm'] as AlgorithmType;
      const status = labels['status'];
      if (algo && algorithmStats[algo]) {
        if (status === 'allowed') {
          algorithmStats[algo].allowed += value;
        } else if (status === 'blocked') {
          algorithmStats[algo].blocked += value;
        }
      }
    }

    // 2. ratelimit_duration_seconds_bucket
    if (metricName === 'ratelimit_duration_seconds_bucket') {
      const leStr = labels['le'];
      const algo = labels['algorithm'] as AlgorithmType;
      if (leStr) {
        const le = leStr === '+Inf' ? Infinity : parseFloat(leStr);
        if (!isNaN(le)) {
          overallBuckets.set(le, (overallBuckets.get(le) ?? 0) + value);
          if (algo && algoBuckets[algo]) {
            algoBuckets[algo].set(le, (algoBuckets[algo].get(le) ?? 0) + value);
          }
        }
      }
    }

    // 3. ratelimit_duration_seconds_count
    if (metricName === 'ratelimit_duration_seconds_count') {
      const algo = labels['algorithm'] as AlgorithmType;
      overallCount += value;
      if (algo && algoCount[algo] !== undefined) {
        algoCount[algo] += value;
      }
    }

    // 4. ratelimit_store_errors_total
    if (metricName === 'ratelimit_store_errors_total') {
      storeErrorsTotal += value;
    }
  }

  const overallLatency = calculatePercentiles(overallBuckets, overallCount);

  const algorithmLatency: Record<AlgorithmType, LatencyPercentiles> = {
    fixed_window: calculatePercentiles(algoBuckets.fixed_window, algoCount.fixed_window),
    sliding_window_log: calculatePercentiles(algoBuckets.sliding_window_log, algoCount.sliding_window_log),
    sliding_window_counter: calculatePercentiles(algoBuckets.sliding_window_counter, algoCount.sliding_window_counter),
    token_bucket: calculatePercentiles(algoBuckets.token_bucket, algoCount.token_bucket),
    leaky_bucket: calculatePercentiles(algoBuckets.leaky_bucket, algoCount.leaky_bucket),
  };

  return {
    algorithmStats,
    overallLatency,
    algorithmLatency,
    storeErrorsTotal,
    timestamp: Date.now(),
  };
}

function calculatePercentiles(bucketMap: Map<number, number>, totalCount: number): LatencyPercentiles {
  if (totalCount <= 0 || bucketMap.size === 0) {
    return { p50Ms: 0, p95Ms: 0, totalChecks: 0 };
  }

  const sortedBuckets: Bucket[] = Array.from(bucketMap.entries())
    .map(([le, count]) => ({ le, count }))
    .sort((a, b) => a.le - b.le);

  const p50Sec = interpolatePercentile(sortedBuckets, 0.5, totalCount);
  const p95Sec = interpolatePercentile(sortedBuckets, 0.95, totalCount);

  return {
    p50Ms: Math.round(p50Sec * 1000 * 100) / 100, // round to 2 decimal places in ms
    p95Ms: Math.round(p95Sec * 1000 * 100) / 100,
    totalChecks: totalCount,
  };
}

function interpolatePercentile(buckets: Bucket[], q: number, total: number): number {
  const targetRank = q * total;
  let prevLe = 0;
  let prevCount = 0;

  for (const bucket of buckets) {
    if (bucket.count >= targetRank) {
      if (bucket.count === prevCount) {
        return bucket.le === Infinity ? prevLe : bucket.le;
      }
      const countSpan = bucket.count - prevCount;
      const rankSpan = targetRank - prevCount;
      const upperLe = bucket.le === Infinity ? prevLe * 2 || 0.5 : bucket.le;
      const fraction = rankSpan / countSpan;
      return prevLe + fraction * (upperLe - prevLe);
    }
    if (bucket.le !== Infinity) {
      prevLe = bucket.le;
      prevCount = bucket.count;
    }
  }

  return prevLe;
}

