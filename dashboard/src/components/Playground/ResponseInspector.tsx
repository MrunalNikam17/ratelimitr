import React, { useState } from 'react';
import { CheckResultLog } from '../../types';

interface ResponseInspectorProps {
  log: CheckResultLog | null;
}

export const ResponseInspector: React.FC<ResponseInspectorProps> = ({ log }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!log) {
    return (
      <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
            Response & RFC Headers
          </span>
          <span className="text-xs font-mono text-zinc-600">No response yet</span>
        </div>
        <p className="text-xs font-mono text-zinc-600 mt-3 text-center py-4">
          Send a request to inspect response headers and JSON body.
        </p>
      </div>
    );
  }

  const is200 = log.allowed;
  const is429 = log.statusCode === 429;
  const is400 = log.statusCode === 400;

  const resetDate = log.resetEpochMs ? new Date(log.resetEpochMs).toLocaleTimeString() : 'N/A';

  return (
    <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs uppercase tracking-wider text-zinc-400 font-medium flex items-center space-x-1.5 hover:text-zinc-200"
          >
            <span>Response & RFC Headers</span>
            <span className="text-[10px] text-zinc-500 font-mono">
              {isOpen ? '[-]' : '[+]'}
            </span>
          </button>
          <span
            className={`text-xs font-mono px-2 py-0.5 rounded font-semibold border ${
              is200
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : is429
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : is400
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            HTTP {log.statusCode} {is200 ? 'OK' : is429 ? 'Too Many Requests' : is400 ? 'Bad Request' : 'Network Error'}
          </span>
        </div>

        <span className="text-xs font-mono text-zinc-500">
          latency: <span className="text-zinc-300">{log.durationMs}ms</span>
        </span>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-3 pt-3 border-t border-zinc-800">
          {/* Rate-limit headers table */}
          <div>
            <div className="text-[11px] font-mono uppercase text-zinc-500 mb-1.5">
              RFC RateLimit Response Headers
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-zinc-950/80 p-2 rounded border border-zinc-800/80">
                <div className="text-zinc-500 text-[10px]">X-RateLimit-Limit</div>
                <div className="text-zinc-200 font-bold mt-0.5">
                  {log.headers['x-ratelimit-limit'] ?? log.limit ?? 'N/A'}
                </div>
              </div>

              <div className="bg-zinc-950/80 p-2 rounded border border-zinc-800/80">
                <div className="text-zinc-500 text-[10px]">X-RateLimit-Remaining</div>
                <div
                  className={`font-bold mt-0.5 ${
                    is429 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {log.headers['x-ratelimit-remaining'] ?? log.remaining ?? '0'}
                </div>
              </div>

              <div className="bg-zinc-950/80 p-2 rounded border border-zinc-800/80">
                <div className="text-zinc-500 text-[10px]">X-RateLimit-Reset</div>
                <div className="text-zinc-200 font-bold mt-0.5 truncate" title={`Epoch: ${log.resetEpochMs} (${resetDate})`}>
                  {log.headers['x-ratelimit-reset'] ?? Math.ceil(log.resetEpochMs / 1000) ?? 'N/A'}
                  <span className="text-zinc-500 font-normal text-[10px] ml-1">({resetDate})</span>
                </div>
              </div>

              <div className="bg-zinc-950/80 p-2 rounded border border-zinc-800/80">
                <div className="text-zinc-500 text-[10px]">Retry-After</div>
                <div
                  className={`font-bold mt-0.5 ${
                    log.retryAfterSec ? 'text-rose-400' : 'text-zinc-500'
                  }`}
                >
                  {log.retryAfterSec !== undefined ? `${log.retryAfterSec}s` : 'None'}
                </div>
              </div>
            </div>
          </div>

          {/* Response Payload JSON */}
          <div>
            <div className="text-[11px] font-mono uppercase text-zinc-500 mb-1">
              Response Body Payload (JSON)
            </div>
            <pre className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed">
              {JSON.stringify(log.rawResponse, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

