import React, { useEffect, useState } from 'react';

interface CountdownTimerProps {
  resetEpochMs: number;
  retryAfterSec?: number;
  lastUpdated: number;
  windowSec: number;
  lastAllowed: boolean | null;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  resetEpochMs,
  retryAfterSec,
  lastUpdated,
  windowSec,
  lastAllowed,
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(0);

  useEffect(() => {
    if (!resetEpochMs && !retryAfterSec) {
      setRemainingMs(0);
      return;
    }

    // Determine target epoch
    let target = resetEpochMs;
    if (retryAfterSec && retryAfterSec > 0) {
      const retryTarget = lastUpdated + retryAfterSec * 1000;
      target = Math.max(target, retryTarget);
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setRemainingMs(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 50);

    return () => clearInterval(interval);
  }, [resetEpochMs, retryAfterSec, lastUpdated]);

  const totalWindowMs = Math.max(1000, (retryAfterSec ? retryAfterSec * 1000 : windowSec * 1000));
  const progressPercent = Math.min(100, Math.max(0, (remainingMs / totalWindowMs) * 100));

  const seconds = (remainingMs / 1000).toFixed(1);
  const isBlocked = lastAllowed === false && remainingMs > 0;

  return (
    <div className="flex flex-col justify-between p-4 bg-zinc-900/60 rounded-xl border border-zinc-800">
      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
          {isBlocked ? 'Retry-After Countdown' : 'Window Reset In'}
        </span>
        <span
          className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
            isBlocked
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : remainingMs > 0
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-zinc-800 border-zinc-700 text-zinc-400'
          }`}
        >
          {remainingMs > 0 ? (isBlocked ? 'BLOCKED' : 'ACTIVE') : 'READY'}
        </span>
      </div>

      <div className="flex flex-col items-center justify-center my-4 text-center">
        <div className="flex items-baseline space-x-1">
          <span className="text-4xl font-mono font-bold tracking-tight text-zinc-100">
            {remainingMs > 0 ? seconds : '0.0'}
          </span>
          <span className="text-sm font-mono text-zinc-500 font-medium">sec</span>
        </div>
        <p className="text-xs font-mono text-zinc-500 mt-1">
          {remainingMs > 0
            ? `${remainingMs}ms until capacity reset`
            : 'Window expired or ready for new requests'}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full space-y-1.5 pt-2 border-t border-zinc-800/80">
        <div className="flex justify-between text-[11px] font-mono text-zinc-500">
          <span>0s</span>
          <span>{windowSec}s window</span>
        </div>
        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-75 ${
              isBlocked ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

