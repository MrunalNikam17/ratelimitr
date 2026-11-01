import React from 'react';
import { CheckResultLog } from '../../types';

interface RequestTimelineProps {
  logs: CheckResultLog[];
  selectedLogId: string | null;
  onSelectLog: (log: CheckResultLog) => void;
  onClear: () => void;
}

export const RequestTimeline: React.FC<RequestTimelineProps> = ({
  logs,
  selectedLogId,
  onSelectLog,
  onClear,
}) => {
  const allowedCount = logs.filter((l) => l.allowed).length;
  const blockedCount = logs.filter((l) => l.statusCode === 429).length;

  return (
    <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-4 flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center space-x-2">
          <span className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
            Live Request Stream
          </span>
          <span className="text-xs font-mono text-zinc-500">
            ({logs.length} logged)
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-400">Allowed:</span>
            <span className="text-emerald-400 font-semibold">{allowedCount}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-zinc-400">Blocked (429):</span>
            <span className="text-rose-400 font-semibold">{blockedCount}</span>
          </div>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-zinc-500 hover:text-zinc-300 ml-2 underline decoration-zinc-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Visual pulse bar / dots */}
      <div className="py-2.5 flex items-center space-x-1 overflow-x-auto min-h-[34px] border-b border-zinc-800/80">
        {logs.length === 0 ? (
          <span className="text-xs font-mono text-zinc-600">
            No requests sent yet. Click Send 1 or Burst to test.
          </span>
        ) : (
          logs.slice(0, 60).map((log) => {
            const is200 = log.allowed;
            const is429 = log.statusCode === 429;
            const isSelected = log.id === selectedLogId;

            return (
              <button
                key={log.id}
                type="button"
                onClick={() => onSelectLog(log)}
                title={`#${log.id} - ${log.statusCode} (${log.durationMs}ms)`}
                className={`w-3 h-6 rounded-sm flex-shrink-0 transition-transform hover:scale-125 focus:outline-none ${
                  is200
                    ? 'bg-emerald-500 hover:bg-emerald-400'
                    : is429
                    ? 'bg-rose-500 hover:bg-rose-400'
                    : 'bg-amber-500 hover:bg-amber-400'
                } ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900' : 'opacity-85'}`}
              />
            );
          })
        )}
      </div>

      {/* Request table / list */}
      <div className="flex-1 overflow-y-auto mt-2 max-h-56 pr-1 divide-y divide-zinc-800/40">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-xs font-mono">
            Waiting for rate limit events...
          </div>
        ) : (
          logs.map((log) => {
            const isSelected = log.id === selectedLogId;
            return (
              <div
                key={log.id}
                onClick={() => onSelectLog(log)}
                className={`flex items-center justify-between py-1.5 px-2 text-xs font-mono rounded cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-zinc-800/90 text-zinc-100'
                    : 'hover:bg-zinc-800/40 text-zinc-400'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      log.allowed
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : log.statusCode === 429
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {log.statusCode || 'ERR'}
                  </span>
                  <span className="text-zinc-500">{log.timeLabel}</span>
                  <span className="text-zinc-300 truncate max-w-[140px]">
                    {log.key}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-right">
                  <span className="text-zinc-500">
                    rem: <span className="text-zinc-300">{log.remaining}</span>
                  </span>
                  <span className="text-zinc-500 w-14">
                    {log.durationMs}ms
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

