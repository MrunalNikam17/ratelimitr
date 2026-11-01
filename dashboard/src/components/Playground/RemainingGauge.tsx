import React from 'react';

interface RemainingGaugeProps {
  remaining: number;
  limit: number;
  lastAllowed: boolean | null;
}

export const RemainingGauge: React.FC<RemainingGaugeProps> = ({
  remaining,
  limit,
  lastAllowed,
}) => {
  const safeLimit = Math.max(1, limit);
  const safeRemaining = Math.max(0, Math.min(safeLimit, remaining));
  const percent = Math.round((safeRemaining / safeLimit) * 100);

  // SVG circular gauge parameters
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  let colorStroke = 'stroke-emerald-500';
  let colorText = 'text-emerald-400';
  let badgeBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';

  if (percent === 0 || lastAllowed === false) {
    colorStroke = 'stroke-rose-500';
    colorText = 'text-rose-400';
    badgeBg = 'bg-rose-500/10 border-rose-500/30 text-rose-400';
  } else if (percent < 35) {
    colorStroke = 'stroke-amber-500';
    colorText = 'text-amber-400';
    badgeBg = 'bg-amber-500/10 border-amber-500/30 text-amber-400';
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-zinc-900/60 rounded-xl border border-zinc-800">
      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
          Quota Remaining
        </span>
        <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${badgeBg}`}>
          {percent}%
        </span>
      </div>

      <div className="relative flex items-center justify-center my-1">
        <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 128 128">
          {/* Background track */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            className="stroke-zinc-800"
            strokeWidth="8"
            fill="transparent"
          />
          {/* Progress arc */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            className={`${colorStroke} transition-all duration-300 ease-out`}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`text-3xl font-bold font-mono tracking-tight ${colorText}`}>
            {safeRemaining}
          </span>
          <span className="text-xs font-mono text-zinc-500">
            of {safeLimit} req
          </span>
        </div>
      </div>

      {/* Capacity status note */}
      <div className="w-full mt-2 text-center text-xs font-mono text-zinc-400 border-t border-zinc-800/80 pt-2">
        {safeRemaining === 0 ? (
          <span className="text-rose-400 font-medium">Exhausted - Rate Limited</span>
        ) : (
          <span>{safeRemaining} requests available</span>
        )}
      </div>
    </div>
  );
};

