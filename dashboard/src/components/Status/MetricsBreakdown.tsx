import React from 'react';
import { AlgorithmType, SystemMetrics, ALGORITHM_LABELS } from '../../types';
import { formatNumber } from '../../utils/formatters';

interface MetricsBreakdownProps {
  metrics: SystemMetrics | null;
}

const ALGORITHMS: AlgorithmType[] = [
  'fixed_window',
  'sliding_window_log',
  'sliding_window_counter',
  'token_bucket',
  'leaky_bucket',
];

export const MetricsBreakdown: React.FC<MetricsBreakdownProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="bg-zinc-900/60 p-5 rounded-xl border border-zinc-800 text-center py-8 text-zinc-500 font-mono text-xs">
        Loading Prometheus metrics...
      </div>
    );
  }

  const { algorithmStats, algorithmLatency } = metrics;

  return (
    <div className="bg-zinc-900/60 p-5 rounded-xl border border-zinc-800 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <span className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
          Algorithm Throughput & Latency Breakdown
        </span>
        <span className="text-xs font-mono text-zinc-500">
          ratelimit_requests_total
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-800/80">
              <th className="pb-2 font-medium">Algorithm</th>
              <th className="pb-2 font-medium text-right">Allowed</th>
              <th className="pb-2 font-medium text-right">Blocked (429)</th>
              <th className="pb-2 font-medium text-right">Total</th>
              <th className="pb-2 font-medium text-right">Pass %</th>
              <th className="pb-2 font-medium text-right">p50 Latency</th>
              <th className="pb-2 font-medium text-right">p95 Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {ALGORITHMS.map((algo) => {
              const stats = algorithmStats[algo] || { allowed: 0, blocked: 0 };
              const total = stats.allowed + stats.blocked;
              const passPercent = total > 0 ? Math.round((stats.allowed / total) * 100) : 0;
              const lat = algorithmLatency[algo] || { p50Ms: 0, p95Ms: 0 };

              return (
                <tr key={algo} className="hover:bg-zinc-850/40 transition-colors">
                  <td className="py-2.5 text-zinc-200 font-medium">
                    {ALGORITHM_LABELS[algo]}
                    <span className="text-zinc-600 block text-[10px]">{algo}</span>
                  </td>
                  <td className="py-2.5 text-right text-emerald-400 font-semibold">
                    {formatNumber(stats.allowed)}
                  </td>
                  <td className="py-2.5 text-right text-rose-400 font-semibold">
                    {formatNumber(stats.blocked)}
                  </td>
                  <td className="py-2.5 text-right text-zinc-300">
                    {formatNumber(total)}
                  </td>
                  <td className="py-2.5 text-right text-zinc-400">
                    {total > 0 ? `${passPercent}%` : '-'}
                  </td>
                  <td className="py-2.5 text-right text-zinc-400">
                    {lat.p50Ms > 0 ? `${lat.p50Ms}ms` : '<0.1ms'}
                  </td>
                  <td className="py-2.5 text-right text-zinc-400">
                    {lat.p95Ms > 0 ? `${lat.p95Ms}ms` : '<0.5ms'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

