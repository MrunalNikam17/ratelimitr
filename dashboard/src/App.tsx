import React, { useState, useEffect, useCallback } from 'react';
import { HealthResponse, SystemMetrics } from './types';
import { fetchHealth, fetchMetrics } from './api/client';
import { Navbar } from './components/Navbar';
import { Playground } from './components/Playground/Playground';
import { Comparison } from './components/Comparison/Comparison';
import { LiveStatus } from './components/Status/LiveStatus';

export const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'playground' | 'comparison' | 'status'>('playground');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [isPolling, setIsPolling] = useState<boolean>(true);
  const [lastPollTime, setLastPollTime] = useState<number | null>(null);

  const pollSystem = useCallback(async () => {
    try {
      const [h, m] = await Promise.all([fetchHealth(), fetchMetrics()]);
      setHealth(h);
      setMetrics(m);
      setBackendOnline(true);
      setLastPollTime(Date.now());
    } catch {
      setBackendOnline(false);
    }
  }, []);

  // Live polling every 2s
  useEffect(() => {
    pollSystem();
    if (!isPolling) return;

    const interval = setInterval(pollSystem, 2000);
    return () => clearInterval(interval);
  }, [isPolling, pollSystem]);

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
      <Navbar
        health={health}
        backendOnline={backendOnline}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {activeSection === 'playground' && <Playground />}
        {activeSection === 'comparison' && <Comparison />}
        {activeSection === 'status' && (
          <LiveStatus
            health={health}
            metrics={metrics}
            backendOnline={backendOnline}
            isPolling={isPolling}
            setIsPolling={setIsPolling}
            onRefresh={pollSystem}
            lastPollTime={lastPollTime}
          />
        )}
      </main>

      <footer className="border-t border-zinc-900 bg-zinc-950/60 py-4 mt-12 text-xs font-mono text-zinc-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            ratelimitr Playground - High-performance distributed rate limiting
          </div>
          <div className="flex items-center space-x-4 text-zinc-500">
            <span>Vite + React + TypeScript</span>
            <span>&bull;</span>
            <span>Recharts & Tailwind CSS</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

