import React, { useState, useRef, useEffect } from 'react';
import { AlgorithmType } from '../../types';
import { checkRateLimit } from '../../api/client';
import { computeNextEpochBoundary } from '../../utils/boundary';
import { AlgorithmCard, SecondBucketData } from './AlgorithmCard';

const ALGORITHMS: AlgorithmType[] = [
  'fixed_window',
  'sliding_window_log',
  'sliding_window_counter',
  'token_bucket',
  'leaky_bucket',
];

interface AlgoResults {
  totalSent: number;
  totalAllowed: number;
  totalBlocked: number;
  buckets: Record<number, { allowed: number; blocked: number }>;
}

export const Comparison: React.FC = () => {
  // Parameters
  const [limit, setLimit] = useState<number>(10);
  const [windowSec, setWindowSec] = useState<number>(4);
  const [burst, setBurst] = useState<number>(10);
  const [selectedPattern, setSelectedPattern] = useState<'boundary' | 'burst' | 'steady'>('boundary');

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to run traffic pattern.');
  const [countdownSeconds, setCountdownSeconds] = useState<string | null>(null);

  // Results per algorithm
  const [results, setResults] = useState<Record<AlgorithmType, AlgoResults>>({
    fixed_window: { totalSent: 0, totalAllowed: 0, totalBlocked: 0, buckets: {} },
    sliding_window_log: { totalSent: 0, totalAllowed: 0, totalBlocked: 0, buckets: {} },
    sliding_window_counter: { totalSent: 0, totalAllowed: 0, totalBlocked: 0, buckets: {} },
    token_bucket: { totalSent: 0, totalAllowed: 0, totalBlocked: 0, buckets: {} },
    leaky_bucket: { totalSent: 0, totalAllowed: 0, totalBlocked: 0, buckets: {} },
  });

  const abortRef = useRef<boolean>(false);

  // Client-side input clamping
  const handleLimitChange = (val: number) => setLimit(Math.min(10000, Math.max(1, isNaN(val) ? 1 : val)));
  const handleWindowSecChange = (val: number) => setWindowSec(Math.min(3600, Math.max(1, isNaN(val) ? 1 : val)));
  const handleBurstChange = (val: number) => setBurst(Math.min(10000, Math.max(1, isNaN(val) ? 1 : val)));

  const clearResults = () => {
    setResults({
      fixed_window: { totalSent: 0, totalAllowed: 0, totalBlocked: 0, buckets: {} },
      sliding_window_log: { totalSent: 0, totalAllowed: 0, totalBlocked: 0, buckets: {} },
      sliding_window_counter: { totalSent: 0, totalAllowed: 0, totalBlocked: 0, buckets: {} },
      token_bucket: { totalSent: 0, totalAllowed: 0, totalBlocked: 0, buckets: {} },
      leaky_bucket: { totalSent: 0, totalAllowed: 0, totalBlocked: 0, buckets: {} },
    });
    setStatusMessage('Cleared previous test run.');
    setCountdownSeconds(null);
  };

  const recordRequest = (algo: AlgorithmType, allowed: boolean, secondOffset: number) => {
    setResults((prev) => {
      const current = prev[algo];
      const prevBucket = current.buckets[secondOffset] || { allowed: 0, blocked: 0 };
      return {
        ...prev,
        [algo]: {
          totalSent: current.totalSent + 1,
          totalAllowed: current.totalAllowed + (allowed ? 1 : 0),
          totalBlocked: current.totalBlocked + (allowed ? 0 : 1),
          buckets: {
            ...current.buckets,
            [secondOffset]: {
              allowed: prevBucket.allowed + (allowed ? 1 : 0),
              blocked: prevBucket.blocked + (allowed ? 0 : 1),
            },
          },
        },
      };
    });
  };

  const runComparison = async () => {
    if (isRunning) return;
    setIsRunning(true);
    abortRef.current = false;

    clearResults();
    const runId = Math.random().toString(36).slice(2, 7);
    const startEpoch = Date.now();

    const getSecondOffset = () => Math.max(0, Math.floor((Date.now() - startEpoch) / 1000));

    try {
      if (selectedPattern === 'boundary') {
        // --- 1. WINDOW-BOUNDARY BURST ---
        setStatusMessage('Calculating next epoch-aligned window boundary...');

        // Window boundary calculation
        const now = Date.now();
        const { boundaryEpochMs, timeUntilBoundaryMs } = computeNextEpochBoundary(windowSec, now);

        // Ensure we have at least 500ms before boundary to fire Burst 1
        let targetBoundary = boundaryEpochMs;
        if (timeUntilBoundaryMs < 600) {
          targetBoundary += windowSec * 1000;
        }

        const burst1Target = targetBoundary - 250; // Fire 250ms before boundary
        const burst2Target = targetBoundary + 150; // Fire 150ms after boundary

        // Countdown until burst 1
        while (Date.now() < burst1Target) {
          if (abortRef.current) break;
          const remSec = ((burst1Target - Date.now()) / 1000).toFixed(1);
          setCountdownSeconds(`${remSec}s`);
          setStatusMessage(`Syncing with epoch window: Firing Burst 1 in ${remSec}s...`);
          await new Promise((r) => setTimeout(r, 60));
        }

        setCountdownSeconds(null);
        setStatusMessage('Firing Burst 1 (100% capacity before boundary)...');

        // Burst 1: Send `limit` requests to all 5 algorithms
        const burst1Promises: Promise<void>[] = [];
        for (const algo of ALGORITHMS) {
          const rule = { algorithm: algo, limit, windowSec, burst };
          const key = `demo-${runId}-${algo}`;
          for (let i = 0; i < limit; i++) {
            burst1Promises.push(
              checkRateLimit({ key, rule }).then((res) => {
                recordRequest(algo, res.allowed, getSecondOffset());
              })
            );
          }
        }
        await Promise.all(burst1Promises);

        // Wait until right after the boundary
        setStatusMessage('Crossing window boundary transition...');
        while (Date.now() < burst2Target) {
          if (abortRef.current) break;
          await new Promise((r) => setTimeout(r, 20));
        }

        setStatusMessage('Firing Burst 2 (100% capacity after boundary)...');

        // Burst 2: Send another `limit` requests to all 5 algorithms
        const burst2Promises: Promise<void>[] = [];
        for (const algo of ALGORITHMS) {
          const rule = { algorithm: algo, limit, windowSec, burst };
          const key = `demo-${runId}-${algo}`;
          for (let i = 0; i < limit; i++) {
            burst2Promises.push(
              checkRateLimit({ key, rule }).then((res) => {
                recordRequest(algo, res.allowed, getSecondOffset());
              })
            );
          }
        }
        await Promise.all(burst2Promises);

        setStatusMessage('Boundary test complete. Observe Fixed Window 2x burst vulnerability.');
      } else if (selectedPattern === 'burst') {
        // --- 2. IMMEDIATE BURST ---
        setStatusMessage('Firing immediate simultaneous burst of 150% limit...');
        const totalReqs = Math.round(limit * 1.5);

        const promises: Promise<void>[] = [];
        for (const algo of ALGORITHMS) {
          const rule = { algorithm: algo, limit, windowSec, burst };
          const key = `demo-${runId}-${algo}`;
          for (let i = 0; i < totalReqs; i++) {
            promises.push(
              checkRateLimit({ key, rule }).then((res) => {
                recordRequest(algo, res.allowed, getSecondOffset());
              })
            );
          }
        }
        await Promise.all(promises);
        setStatusMessage(`Burst complete. Sent ${totalReqs} concurrent requests to each algorithm.`);
      } else {
        // --- 3. STEADY TRAFFIC ---
        setStatusMessage(`Sending steady traffic over ${windowSec} seconds...`);
        const totalReqs = Math.round(limit * 1.5);
        const intervalMs = Math.max(50, Math.floor((windowSec * 1000) / totalReqs));

        for (let i = 0; i < totalReqs; i++) {
          if (abortRef.current) break;

          const stepPromises = ALGORITHMS.map((algo) => {
            const rule = { algorithm: algo, limit, windowSec, burst };
            const key = `demo-${runId}-${algo}`;
            return checkRateLimit({ key, rule }).then((res) => {
              recordRequest(algo, res.allowed, getSecondOffset());
            });
          });

          await Promise.all(stepPromises);
          await new Promise((r) => setTimeout(r, intervalMs));
        }

        setStatusMessage('Steady traffic run complete.');
      }
    } finally {
      setIsRunning(false);
      setCountdownSeconds(null);
    }
  };

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  // Format buckets for Recharts
  const formatChartData = (algo: AlgorithmType): SecondBucketData[] => {
    const bucketMap = results[algo].buckets;
    const secondKeys = Object.keys(bucketMap)
      .map(Number)
      .sort((a, b) => a - b);

    if (secondKeys.length === 0) return [];

    const maxSecond = Math.max(...secondKeys);
    const data: SecondBucketData[] = [];
    for (let s = 0; s <= Math.max(maxSecond, 3); s++) {
      const b = bucketMap[s] || { allowed: 0, blocked: 0 };
      data.push({
        timeLabel: `t+${s}s`,
        allowed: b.allowed,
        blocked: b.blocked,
      });
    }
    return data;
  };

  return (
    <div className="space-y-6">
      {/* Header and Recruiter explanation */}
      <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
            Algorithm Comparison & Boundary Exploit Analysis
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Test the same traffic pattern concurrently across all 5 rate limiting algorithms with isolated keys.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {countdownSeconds && (
            <div className="px-3 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold animate-pulse">
              BOUNDARY SYNC: {countdownSeconds}
            </div>
          )}
          <div className="text-xs font-mono px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">
            STATUS: <span className="text-zinc-200">{statusMessage}</span>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 text-xs font-mono">
          {/* Pattern Selector */}
          <div className="space-y-1">
            <label className="text-zinc-400 font-medium">Traffic Pattern</label>
            <select
              value={selectedPattern}
              onChange={(e) => setSelectedPattern(e.target.value as any)}
              disabled={isRunning}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            >
              <option value="boundary">Window-Boundary Burst (2x Exploit)</option>
              <option value="burst">Instant 150% Burst</option>
              <option value="steady">Steady Continuous Rate</option>
            </select>
          </div>

          {/* Limit */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-zinc-400 font-medium">Shared Limit</label>
              <span className="text-zinc-500 text-[10px]">max 10,000</span>
            </div>
            <input
              type="number"
              min="1"
              max="10000"
              value={limit}
              onChange={(e) => handleLimitChange(parseInt(e.target.value, 10))}
              disabled={isRunning}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />
          </div>

          {/* WindowSec */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-zinc-400 font-medium">Window (Sec)</label>
              <span className="text-zinc-500 text-[10px]">max 3,600</span>
            </div>
            <input
              type="number"
              min="1"
              max="3600"
              value={windowSec}
              onChange={(e) => handleWindowSecChange(parseInt(e.target.value, 10))}
              disabled={isRunning}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />
          </div>

          {/* Burst */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-zinc-400 font-medium">Bucket Burst</label>
              <span className="text-emerald-400 text-[10px]">max 10,000</span>
            </div>
            <input
              type="number"
              min="1"
              max="10000"
              value={burst}
              onChange={(e) => handleBurstChange(parseInt(e.target.value, 10))}
              disabled={isRunning}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-end space-x-2">
            <button
              type="button"
              disabled={isRunning}
              onClick={runComparison}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-zinc-950 font-bold px-4 py-2 rounded text-xs font-mono transition-colors shadow-sm"
            >
              {isRunning ? 'Running Traffic...' : 'Run Comparison'}
            </button>
            <button
              type="button"
              disabled={isRunning}
              onClick={clearResults}
              className="bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-850 disabled:opacity-50 text-zinc-400 hover:text-zinc-200 px-3 py-2 rounded text-xs font-mono transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Boundary Exploit Notice */}
        {selectedPattern === 'boundary' && (
          <div className="text-xs font-mono bg-zinc-950/80 p-3 rounded border border-zinc-800 text-zinc-400 leading-relaxed">
            <span className="text-emerald-400 font-semibold">Boundary Test Mechanics:</span>{' '}
            Epoch-aligned boundary calculated via <code className="text-zinc-200">Date.now() % windowMs</code>. Burst 1 fires {limit} reqs right before the boundary (admitted). Burst 2 fires {limit} reqs right after the boundary. Fixed window resets counter to 0 at boundary and admits all {limit * 2} requests (~2x limit!), whereas Sliding Window Log, Counter, and Bucket algorithms strictly throttle.
          </div>
        )}
      </div>

      {/* 5 Small-Multiple Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {ALGORITHMS.map((algo) => (
          <AlgorithmCard
            key={algo}
            algorithm={algo}
            data={formatChartData(algo)}
            totalSent={results[algo].totalSent}
            totalAllowed={results[algo].totalAllowed}
            totalBlocked={results[algo].totalBlocked}
            pattern={selectedPattern}
          />
        ))}
      </div>
    </div>
  );
};
