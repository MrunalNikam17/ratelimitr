import { CheckRequestBody, CheckResultLog, HealthResponse, SystemMetrics } from '../types';
import { parsePrometheusMetrics } from './prometheus';

export async function checkRateLimit(request: CheckRequestBody): Promise<CheckResultLog> {
  const start = performance.now();
  const timestamp = Date.now();
  const timeLabel = new Date(timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + (timestamp % 1000).toString().padStart(3, '0');

  try {
    const res = await fetch('/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const durationMs = Math.round((performance.now() - start) * 10) / 10;
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let rawResponse: Record<string, unknown> = {};
    try {
      rawResponse = await res.json();
    } catch {
      rawResponse = { error: 'Failed to parse JSON body' };
    }

    const limit = Number(headers['x-ratelimit-limit'] ?? rawResponse['limit'] ?? (request.rule?.limit || 0));
    const remaining = Number(headers['x-ratelimit-remaining'] ?? rawResponse['remaining'] ?? 0);
    const resetEpochSec = Number(headers['x-ratelimit-reset'] ?? 0);
    const resetEpochMs = Number(rawResponse['resetEpochMs'] ?? (resetEpochSec ? resetEpochSec * 1000 : 0));
    const resetMs = Number(rawResponse['resetMs'] ?? (resetEpochMs > timestamp ? resetEpochMs - timestamp : 0));
    const retryAfterSec = headers['retry-after'] ? Number(headers['retry-after']) : (rawResponse['retryAfterSec'] as number | undefined);

    const allowed = res.status === 200;

    return {
      id: `${timestamp}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp,
      timeLabel,
      allowed,
      statusCode: res.status,
      remaining,
      limit,
      resetMs,
      resetEpochMs,
      retryAfterSec,
      durationMs,
      cost: request.cost ?? 1,
      algorithm: request.rule?.algorithm ?? 'token_bucket',
      key: request.key,
      headers,
      rawResponse,
    };
  } catch (err) {
    const durationMs = Math.round((performance.now() - start) * 10) / 10;
    return {
      id: `${timestamp}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp,
      timeLabel,
      allowed: false,
      statusCode: 0, // Network failure
      remaining: 0,
      limit: request.rule?.limit ?? 0,
      resetMs: 0,
      resetEpochMs: 0,
      durationMs,
      cost: request.cost ?? 1,
      algorithm: request.rule?.algorithm ?? 'token_bucket',
      key: request.key,
      headers: {},
      rawResponse: { error: 'Network error or backend unreachable', message: (err as Error).message },
    };
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/health');
  if (res.status === 200 || res.status === 503) {
    return await res.json();
  }
  throw new Error(`Health check returned status ${res.status}`);
}

export async function fetchMetrics(): Promise<SystemMetrics> {
  const res = await fetch('/metrics');
  if (!res.ok) {
    throw new Error(`Metrics endpoint returned status ${res.status}`);
  }
  const text = await res.text();
  return parsePrometheusMetrics(text);
}

