import React, { useState, useEffect, useRef } from 'react';
import { AlgorithmType, CheckResultLog, ALGORITHM_LABELS, ALGORITHM_DESCRIPTIONS } from '../../types';
import { checkRateLimit } from '../../api/client';
import { RemainingGauge } from './RemainingGauge';
import { CountdownTimer } from './CountdownTimer';
import { RequestTimeline } from './RequestTimeline';
import { ResponseInspector } from './ResponseInspector';

export const Playground: React.FC = () => {
  // Form state
  const [key, setKey] = useState<string>('user:recruiter_demo');
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('token_bucket');
  const [limit, setLimit] = useState<number>(10);
  const [windowSec, setWindowSec] = useState<number>(10);
  const [burst, setBurst] = useState<number>(15);
  const [cost, setCost] = useState<number>(1);

  // Send action state
  const [burstCount, setBurstCount] = useState<number>(10);
  const [autoRate, setAutoRate] = useState<number>(5);
  const [isAutoSending, setIsAutoSending] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  // Results state
  const [logs, setLogs] = useState<CheckResultLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<CheckResultLog | null>(null);

  // Latest remaining / reset state
  const latestLog = logs[0] ?? null;
  const currentRemaining = latestLog ? latestLog.remaining : limit;
  const resetEpochMs = latestLog ? latestLog.resetEpochMs : 0;
  const retryAfterSec = latestLog ? latestLog.retryAfterSec : undefined;
  const lastUpdated = latestLog ? latestLog.timestamp : 0;
  const lastAllowed = latestLog ? latestLog.allowed : null;

  const autoSendTimerRef = useRef<number | null>(null);

  // Client-side Clamping helpers
  const handleLimitChange = (val: number) => setLimit(Math.min(10000, Math.max(1, isNaN(val) ? 1 : val)));
  const handleWindowSecChange = (val: number) => setWindowSec(Math.min(3600, Math.max(1, isNaN(val) ? 1 : val)));
  const handleBurstChange = (val: number) => setBurst(Math.min(10000, Math.max(1, isNaN(val) ? 1 : val)));
  const handleCostChange = (val: number) => setCost(Math.min(100, Math.max(1, isNaN(val) ? 1 : val)));
  const handleBurstCountChange = (val: number) => setBurstCount(Math.min(500, Math.max(1, isNaN(val) ? 1 : val)));
  const handleAutoRateChange = (val: number) => setAutoRate(Math.min(50, Math.max(1, isNaN(val) ? 1 : val)));

  const isBucketAlgo = algorithm === 'token_bucket' || algorithm === 'leaky_bucket';

  const sendSingleRequest = async () => {
    setIsSending(true);
    const rule = {
      algorithm,
      limit,
      windowSec,
      ...(isBucketAlgo ? { burst } : {}),
    };

    const result = await checkRateLimit({
      key,
      rule,
      cost,
    });

    setLogs((prev) => [result, ...prev.slice(0, 99)]);
    setSelectedLog(result);
    setIsSending(false);
  };

  const sendBurstRequests = async () => {
    if (isSending) return;
    setIsSending(true);
    const rule = {
      algorithm,
      limit,
      windowSec,
      ...(isBucketAlgo ? { burst } : {}),
    };

    const count = Math.min(500, Math.max(1, burstCount));
    const promises = Array.from({ length: count }, () =>
      checkRateLimit({ key, rule, cost })
    );

    const results = await Promise.all(promises);
    setLogs((prev) => [...results.reverse(), ...prev].slice(0, 100));
    if (results.length > 0) {
      setSelectedLog(results[0]);
    }
    setIsSending(false);
  };

  // Auto-send loop
  useEffect(() => {
    if (!isAutoSending) {
      if (autoSendTimerRef.current) {
        clearInterval(autoSendTimerRef.current);
        autoSendTimerRef.current = null;
      }
      return;
    }

    const intervalMs = Math.max(20, Math.floor(1000 / Math.min(50, Math.max(1, autoRate))));
    const rule = {
      algorithm,
      limit,
      windowSec,
      ...(isBucketAlgo ? { burst } : {}),
    };

    autoSendTimerRef.current = window.setInterval(async () => {
      const res = await checkRateLimit({ key, rule, cost });
      setLogs((prev) => [res, ...prev.slice(0, 99)]);
      setSelectedLog(res);
    }, intervalMs);

    return () => {
      if (autoSendTimerRef.current) {
        clearInterval(autoSendTimerRef.current);
        autoSendTimerRef.current = null;
      }
    };
  }, [isAutoSending, autoRate, key, algorithm, limit, windowSec, burst, cost, isBucketAlgo]);

  return (
    <div className="space-y-6">
      {/* Overview & Quick explanation */}
      <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
            Interactive Rate Limit Playground
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Send live traffic to Express & Redis, inspect quota consumption in real time, and observe atomic header enforcement.
          </p>
        </div>
        <div className="text-xs font-mono px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">
          ALGORITHM: <span className="text-emerald-400 font-semibold">{ALGORITHM_LABELS[algorithm]}</span>
        </div>
      </div>

      {/* Main Grid: Form controls + Live Gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Configuration & Send actions */}
        <div className="lg:col-span-7 space-y-5">
          {/* Rule Configuration Card */}
          <div className="bg-zinc-900/60 p-5 rounded-xl border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
                Rule & Request Parameters
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                POST /check
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              {/* Key */}
              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">Rate Limit Key</label>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value.trim() || 'user:demo')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="e.g. user:123 or ip:127.0.0.1"
                />
              </div>

              {/* Algorithm */}
              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">Algorithm</label>
                <select
                  value={algorithm}
                  onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="fixed_window">Fixed Window Counter</option>
                  <option value="sliding_window_log">Sliding Window Log</option>
                  <option value="sliding_window_counter">Sliding Window Counter</option>
                  <option value="token_bucket">Token Bucket</option>
                  <option value="leaky_bucket">Leaky Bucket</option>
                </select>
              </div>

              {/* Limit */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-zinc-400 font-medium">Limit (Req)</label>
                  <span className="text-zinc-500 text-[10px]">max 10,000</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={limit}
                  onChange={(e) => handleLimitChange(parseInt(e.target.value, 10))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-emerald-500"
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
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Burst (only for token/leaky bucket) */}
              {isBucketAlgo && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-zinc-400 font-medium">Burst Capacity</label>
                    <span className="text-emerald-400 text-[10px]">bucket only</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={burst}
                    onChange={(e) => handleBurstChange(parseInt(e.target.value, 10))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Cost */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-zinc-400 font-medium">Request Cost</label>
                  <span className="text-zinc-500 text-[10px]">max 100</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={cost}
                  onChange={(e) => handleCostChange(parseInt(e.target.value, 10))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2 text-[11px] text-zinc-500 font-mono border-t border-zinc-800/80">
              {ALGORITHM_DESCRIPTIONS[algorithm]}
            </div>
          </div>

          {/* Action Dispatch Buttons */}
          <div className="bg-zinc-900/60 p-5 rounded-xl border border-zinc-800 space-y-4">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-medium block">
              Traffic Generators
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Send 1 */}
              <button
                type="button"
                disabled={isSending || isAutoSending}
                onClick={sendSingleRequest}
                className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-zinc-950 font-semibold px-4 py-2.5 rounded-lg text-xs font-mono transition-colors shadow-sm"
              >
                <span>Send 1 Req</span>
                <span className="text-[10px] opacity-75 font-normal">(cost {cost})</span>
              </button>

              {/* Burst N */}
              <div className="flex rounded-lg overflow-hidden border border-zinc-700/80">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={burstCount}
                  onChange={(e) => handleBurstCountChange(parseInt(e.target.value, 10))}
                  className="w-16 bg-zinc-950 text-zinc-100 px-2 py-1 text-xs font-mono text-center focus:outline-none border-r border-zinc-800"
                  title="Burst count (max 500)"
                />
                <button
                  type="button"
                  disabled={isSending || isAutoSending}
                  onClick={sendBurstRequests}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-850 disabled:opacity-50 text-zinc-100 font-semibold px-2 py-2 text-xs font-mono transition-colors text-center"
                >
                  Burst {burstCount}
                </button>
              </div>

              {/* Auto-send at X req/s */}
              <div className="flex rounded-lg overflow-hidden border border-zinc-700/80">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={autoRate}
                  onChange={(e) => handleAutoRateChange(parseInt(e.target.value, 10))}
                  disabled={isAutoSending}
                  className="w-14 bg-zinc-950 text-zinc-100 px-2 py-1 text-xs font-mono text-center focus:outline-none border-r border-zinc-800 disabled:opacity-60"
                  title="Req/s (max 50)"
                />
                <button
                  type="button"
                  onClick={() => setIsAutoSending(!isAutoSending)}
                  className={`flex-1 font-semibold px-2 py-2 text-xs font-mono transition-colors text-center ${
                    isAutoSending
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                  }`}
                >
                  {isAutoSending ? 'Stop Auto' : `Auto ${autoRate}/s`}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Gauges and Countdown */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
          <RemainingGauge
            remaining={currentRemaining}
            limit={limit}
            lastAllowed={lastAllowed}
          />

          <CountdownTimer
            resetEpochMs={resetEpochMs}
            retryAfterSec={retryAfterSec}
            lastUpdated={lastUpdated}
            windowSec={windowSec}
            lastAllowed={lastAllowed}
          />
        </div>
      </div>

      {/* Request Timeline */}
      <RequestTimeline
        logs={logs}
        selectedLogId={selectedLog?.id ?? null}
        onSelectLog={(log) => setSelectedLog(log)}
        onClear={() => {
          setLogs([]);
          setSelectedLog(null);
        }}
      />

      {/* Response and RFC Headers Inspector */}
      <ResponseInspector log={selectedLog} />
    </div>
  );
};

