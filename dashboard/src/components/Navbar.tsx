import React from 'react';
import { HealthResponse } from '../types';
import { formatUptime } from '../utils/formatters';

interface NavbarProps {
  health: HealthResponse | null;
  backendOnline: boolean;
  activeSection: 'playground' | 'comparison' | 'status';
  setActiveSection: (section: 'playground' | 'comparison' | 'status') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  backendOnline,
  activeSection,
  setActiveSection,
}) => {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-[#090a0f]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Project info */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 rounded bg-zinc-900 border border-zinc-800 text-emerald-400 font-mono font-bold text-sm">
              RL
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-zinc-100 tracking-tight text-sm sm:text-base">
                  ratelimitr
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono border border-zinc-700/60">
                  Playground
                </span>
              </div>
            </div>
          </div>

          {/* Section Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveSection('playground')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeSection === 'playground'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              Playground
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('comparison')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeSection === 'comparison'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              Algorithm Comparison
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('status')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeSection === 'status'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              Cluster Observability
            </button>
          </nav>

          {/* Status Badges */}
          <div className="hidden sm:flex items-center space-x-3 text-xs font-mono">
            {/* Backend status */}
            <div className="flex items-center space-x-1.5 bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className={backendOnline ? 'text-zinc-300' : 'text-rose-400'}>
                {backendOnline ? 'BACKEND OK' : 'OFFLINE'}
              </span>
            </div>

            {/* Redis status */}
            <div className="flex items-center space-x-1.5 bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800">
              <span
                className={`w-2 h-2 rounded-full ${
                  health?.redis ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className={health?.redis ? 'text-zinc-300' : 'text-amber-400'}>
                {health?.redis ? 'REDIS READY' : 'IN-MEMORY'}
              </span>
            </div>

            {/* Uptime */}
            {health && (
              <div className="text-zinc-500 text-xs">
                UP: <span className="text-zinc-300">{formatUptime(health.uptime)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

