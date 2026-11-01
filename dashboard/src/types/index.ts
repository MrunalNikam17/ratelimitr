export type AlgorithmType =
  | 'fixed_window'
  | 'sliding_window_log'
  | 'sliding_window_counter'
  | 'token_bucket'
  | 'leaky_bucket';

export const ALGORITHM_LABELS: Record<AlgorithmType, string> = {
  fixed_window: 'Fixed Window',
  sliding_window_log: 'Sliding Window Log',
  sliding_window_counter: 'Sliding Window Counter',
  token_bucket: 'Token Bucket',
  leaky_bucket: 'Leaky Bucket',
};

export const ALGORITHM_DESCRIPTIONS: Record<AlgorithmType, string> = {
  fixed_window: 'Resets counters at discrete window boundaries; vulnerable to 2x burst across boundary transitions.',
  sliding_window_log: 'Preserves timestamp logs for 100% accuracy; eliminates window-boundary exploits with zero drift.',
  sliding_window_counter: 'Estimates rate by weighting the previous window against current window; memory-efficient O(1).',
  token_bucket: 'Continuously refills tokens at a fixed rate; cleanly accommodates configured sudden bursts.',
  leaky_bucket: 'Smooths incoming traffic to a constant, smooth egress rate; queues or blocks surges beyond capacity.',
};

export interface RateLimitRule {
  algorithm: AlgorithmType;
  limit: number;
  windowSec: number;
  burst?: number;
}

export interface CheckRequestBody {
  key: string;
  rule?: RateLimitRule;
  cost?: number;
}

export interface CheckResponse {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  resetEpochMs: number;
  retryAfterSec?: number;
}

export interface CheckResultLog {
  id: string;
  timestamp: number;
  timeLabel: string;
  allowed: boolean;
  statusCode: number;
  remaining: number;
  limit: number;
  resetMs: number;
  resetEpochMs: number;
  retryAfterSec?: number;
  durationMs: number;
  cost: number;
  algorithm: AlgorithmType;
  key: string;
  headers: Record<string, string>;
  rawResponse: Record<string, unknown>;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  redis: boolean;
  uptime: number;
  timestamp: string;
}

export interface AlgorithmMetrics {
  allowed: number;
  blocked: number;
}

export interface LatencyPercentiles {
  p50Ms: number;
  p95Ms: number;
  totalChecks: number;
}

export interface SystemMetrics {
  algorithmStats: Record<AlgorithmType, AlgorithmMetrics>;
  overallLatency: LatencyPercentiles;
  algorithmLatency: Record<AlgorithmType, LatencyPercentiles>;
  storeErrorsTotal: number;
  timestamp: number;
}

