import React from 'react';
import { HealthResponse, SystemMetrics } from '../../types';
import { formatUptime, formatNumber } from '../../utils/formatters';
import { LatencyCard } from './LatencyCard';
import { MetricsBreakdown } from './MetricsBreakdown';

interface LiveStatusProps {
  health: HealthResponse | null;
  metrics: SystemMetrics | null;
  backendOnline: boolean;
  isPolling: boolean;
  setIsPolling: (val: boolean) => void;
  onRefresh: () => void;
  lastPollTime: number | null;
}

export const LiveStatus: React.FC<LiveStatusProps> = ({
  health,
  metrics,
  backendOnline,
  isPolling,
  setIsPolling,
  onRefresh,
  lastPollTime,
}) => {
  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
            Cluster Observability & Metrics
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time telemetry gathered from <code className="text-zinc-300">/health</code> and Prometheus <code className="text-zinc-300">/metrics</code>.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          {lastPollTime && (
            <span className="text-zinc-500 hidden md:inline">
              Polled: {new Date(lastPollTime).toLocaleTimeString()}
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsPolling(!isPolling)}
            className={`px-3 py-1.5 rounded font-medium transition-colors border ${
              isPolling
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            {isPolling ? 'Polling Active (2s)' : 'Polling Paused'}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors font-medium"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Backend Unreachable State */}
      {!backendOnline && (
        <div className="bg-rose-950/20 border border-rose-500/40 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <div>
              <div className="text-sm font-semibold text-rose-400">
                Backend Service Unreachable
              </div>
              <div className="text-xs text-zinc-400 mt-0.5 font-mono">
                Cannot connect to http://localhost:3000. Ensure the server is running (npm run dev).
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-mono font-semibold"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Server Status */}
        <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
              Server Status
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                backendOnline ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
          </div>
          <div className="text-xl font-mono font-bold text-zinc-100 mt-2">
            {backendOnline ? (health?.status === 'ok' ? 'HEALTHY' : 'DEGRADED') : 'OFFLINE'}
          </div>
          <div className="text-xs font-mono text-zinc-500 mt-1">
            HTTP status: {backendOnline ? '200 OK' : 'Unavailable'}
          </div>
        </div>

        {/* Card 2: Redis Engine */}
        <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
              Storage Engine
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                health?.redis ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </div>
          <div className="text-xl font-mono font-bold text-zinc-100 mt-2">
            {health?.redis ? 'REDIS CLUSTER' : 'IN-MEMORY'}
          </div>
          <div className="text-xs font-mono text-zinc-500 mt-1">
            {health?.redis ? 'Atomic Lua evaluation' : 'Local process fallback'}
          </div>
        </div>

        {/* Card 3: Uptime */}
        <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
              System Uptime
            </span>
            <span className="text-xs font-mono text-zinc-500">Node.js</span>
          </div>
          <div className="text-xl font-mono font-bold text-zinc-100 mt-2">
            {health ? formatUptime(health.uptime) : '0s'}
          </div>
          <div className="text-xs font-mono text-zinc-500 mt-1">
            {health ? new Date(health.timestamp).toLocaleTimeString() : 'N/A'}
          </div>
        </div>

        {/* Card 4: Store Errors */}
        <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
              Store Errors
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                (metrics?.storeErrorsTotal ?? 0) === 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {(metrics?.storeErrorsTotal ?? 0) === 0 ? 'ZERO ERRORS' : 'FAILS DETECTED'}
            </span>
          </div>
          <div className="text-xl font-mono font-bold text-zinc-100 mt-2">
            {formatNumber(metrics?.storeErrorsTotal ?? 0)}
          </div>
          <div className="text-xs font-mono text-zinc-500 mt-1">
            ratelimit_store_errors_total
          </div>
        </div>
      </div>

      {/* Latency and Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <LatencyCard
            overallLatency={
              metrics?.overallLatency ?? { p50Ms: 0, p95Ms: 0, totalChecks: 0 }
            }
          />
        </div>

        <div className="lg:col-span-2">
          <MetricsBreakdown metrics={metrics} />
        </div>
      </div>
    </div>
  );
};

