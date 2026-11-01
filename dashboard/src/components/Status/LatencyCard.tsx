import React from 'react';
import { LatencyPercentiles } from '../../types';
import { formatNumber } from '../../utils/formatters';

interface LatencyCardProps {
  overallLatency: LatencyPercentiles;
}

export const LatencyCard: React.FC<LatencyCardProps> = ({ overallLatency }) => {
  const { p50Ms, p95Ms, totalChecks } = overallLatency;

  return (
    <div className="bg-zinc-900/60 p-5 rounded-xl border border-zinc-800 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <span className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
          Check Latency (Prometheus Histogram)
        </span>
        <span className="text-xs font-mono text-zinc-500">
          ratelimit_duration_seconds
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 my-4">
        {/* p50 */}
        <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800/80 text-center">
          <div className="text-[11px] font-mono uppercase text-zinc-500">
            Median (p50)
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
            {p50Ms > 0 ? `${p50Ms}ms` : '<0.1ms'}
          </div>
          <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
            50% of checks faster
          </div>
        </div>

        {/* p95 */}
        <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800/80 text-center">
          <div className="text-[11px] font-mono uppercase text-zinc-500">
            Tail (p95)
          </div>
          <div className="text-2xl font-mono font-bold text-sky-400 mt-1">
            {p95Ms > 0 ? `${p95Ms}ms` : '<0.5ms'}
          </div>
          <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
            95% of checks faster
          </div>
        </div>
      </div>

      <div className="text-xs font-mono text-zinc-400 flex items-center justify-between pt-2 border-t border-zinc-800/80">
        <span>Evaluated checks:</span>
        <span className="text-zinc-200 font-bold">{formatNumber(totalChecks)}</span>
      </div>
    </div>
  );
};

