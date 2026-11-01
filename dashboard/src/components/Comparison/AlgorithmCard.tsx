import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { AlgorithmType, ALGORITHM_LABELS, ALGORITHM_DESCRIPTIONS } from '../../types';

export interface SecondBucketData {
  timeLabel: string;
  allowed: number;
  blocked: number;
}

interface AlgorithmCardProps {
  algorithm: AlgorithmType;
  data: SecondBucketData[];
  totalSent: number;
  totalAllowed: number;
  totalBlocked: number;
  pattern: 'steady' | 'burst' | 'boundary';
}

export const AlgorithmCard: React.FC<AlgorithmCardProps> = ({
  algorithm,
  data,
  totalSent,
  totalAllowed,
  totalBlocked,
  pattern,
}) => {
  const allowRate = totalSent > 0 ? Math.round((totalAllowed / totalSent) * 100) : 0;

  // Tailored pattern-specific explanation
  let patternNote = ALGORITHM_DESCRIPTIONS[algorithm];
  if (pattern === 'boundary') {
    if (algorithm === 'fixed_window') {
      patternNote = 'CRITICAL: Window reset at boundary allowed Burst 1 AND Burst 2 (~2x limit admitted!).';
    } else if (algorithm === 'sliding_window_log') {
      patternNote = 'PREVENTED: Exact log timestamps retained across boundary; Burst 2 blocked cleanly.';
    } else if (algorithm === 'sliding_window_counter') {
      patternNote = 'PREVENTED: Previous window weighted heavily at boundary entry; Burst 2 blocked.';
    } else if (algorithm === 'token_bucket') {
      patternNote = 'PREVENTED: Bucket depleted by Burst 1; minimal token refill in 400ms blocked Burst 2.';
    } else if (algorithm === 'leaky_bucket') {
      patternNote = 'PREVENTED: Capacity filled by Burst 1; constant egress leak rate rejected sudden overflow.';
    }
  }

  const isVulnerable = pattern === 'boundary' && algorithm === 'fixed_window' && totalAllowed > 12;

  return (
    <div
      className={`bg-zinc-900/70 rounded-xl border p-4 flex flex-col justify-between transition-all ${
        isVulnerable
          ? 'border-rose-500/60 ring-1 ring-rose-500/40 bg-rose-950/10'
          : 'border-zinc-800'
      }`}
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm text-zinc-100">
              {ALGORITHM_LABELS[algorithm]}
            </span>
            {isVulnerable && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold">
                2X BURST ADMITTED
              </span>
            )}
          </div>
          <span className="text-xs font-mono text-zinc-500">
            {algorithm}
          </span>
        </div>

        {/* One-line explanation */}
        <p
          className={`text-xs mt-1 leading-snug ${
            isVulnerable ? 'text-rose-300 font-medium' : 'text-zinc-400'
          }`}
        >
          {patternNote}
        </p>

        {/* Stats summary row */}
        <div className="grid grid-cols-4 gap-2 my-3 py-2 px-2.5 bg-zinc-950/80 rounded border border-zinc-800/80 text-xs font-mono">
          <div>
            <div className="text-[10px] text-zinc-500">Sent</div>
            <div className="font-bold text-zinc-200">{totalSent}</div>
          </div>
          <div>
            <div className="text-[10px] text-emerald-400">Allowed</div>
            <div className="font-bold text-emerald-400">{totalAllowed}</div>
          </div>
          <div>
            <div className="text-[10px] text-rose-400">Blocked</div>
            <div className="font-bold text-rose-400">{totalBlocked}</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500">Pass %</div>
            <div className="font-bold text-zinc-300">{allowRate}%</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-32 mt-2">
        {data.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-xs font-mono text-zinc-600 bg-zinc-950/40 rounded border border-zinc-900">
            Awaiting traffic pattern...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <XAxis
                dataKey="timeLabel"
                stroke="#52525b"
                tick={{ fontSize: 10, fill: '#71717a' }}
              />
              <YAxis
                stroke="#52525b"
                tick={{ fontSize: 10, fill: '#71717a' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#090a0f',
                  borderColor: '#27272a',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  borderRadius: '6px',
                }}
              />
              <Bar dataKey="allowed" name="Allowed" stackId="a" fill="#10b981" />
              <Bar dataKey="blocked" name="Blocked (429)" stackId="a" fill="#f43f5e" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

