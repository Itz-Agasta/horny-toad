import { useState, useEffect, useRef, useMemo } from 'react';
import weightsData from './weights.json' with { type: 'json' };
import { LewisNeuralEngine } from './engine/neural.ts';
import { SimulationGrid } from './engine/simulation.ts';
import { PRESETS } from './engine/presets.ts';
import { GridCanvas } from './components/GridCanvas.tsx';
import { CodebookModal } from './components/CodebookModal.tsx';
import { Play, Pause, StepForward, RotateCcw, Shuffle, Sparkles, Clock, MessagesSquare, BookOpen } from 'lucide-react';

export function App() {
  const engine = useMemo(() => new LewisNeuralEngine(weightsData as any), []);

  const gridRef = useRef<SimulationGrid | null>(null);
  if (!gridRef.current) {
    const newGrid = new SimulationGrid(64, 64, engine);
    PRESETS[0].load(newGrid);
    gridRef.current = newGrid;
  }
  const grid = gridRef.current;

  const [, setTick] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  // Snappier cadence so birth/death pops read like LIFE.gif; elapsed still hits 45s wall-clock
  const turnSpeedMs = 180;
  const [viewMode, setViewMode] = useState<'1bit' | 'dialect'>('1bit');
  const [showSynapses, setShowSynapses] = useState<boolean>(true);
  const [isCodebookOpen, setIsCodebookOpen] = useState<boolean>(false);
  const [visualEpoch, setVisualEpoch] = useState<number>(0);

  // Stop stepping once evaluation reaches 45 seconds
  const stepTurn = () => {
    if (grid.stats.isComplete) {
      setIsRunning(false);
      return;
    }
    grid.stepTurn(turnSpeedMs / 1000);
    if (grid.stats.isComplete) {
      setIsRunning(false);
    }
    setTick((t) => t + 1);
  };

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(stepTurn, turnSpeedMs);
    return () => clearInterval(interval);
  }, [isRunning, turnSpeedMs]);

  const stats = grid.stats;
  const accPct = (stats.accuracy * 100).toFixed(1);
  const currentSeconds = Math.min(45, Math.floor(stats.elapsedSeconds));

  const restartWithPreset = (presetFn: () => void) => {
    presetFn();
    setVisualEpoch((e) => e + 1);
    setIsRunning(true);
    setTick((t) => t + 1);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-between p-4 sm:p-6 select-none font-mono">
      {/* Codebook Modal */}
      <CodebookModal
        isOpen={isCodebookOpen}
        onClose={() => setIsCodebookOpen(false)}
      />

      {/* 1. Header & Live 45s Multi-Turn Dialogue Status */}
      <header className="w-full max-w-2xl flex flex-col items-center gap-3 text-center">
        <div className="flex items-center justify-between w-full">
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase">
              LEWIS × CONWAY
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5 tracking-tight">
              45-Second Multi-Turn Consensus Evaluation
            </p>
          </div>

          <button
            onClick={() => setIsCodebookOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 text-xs font-bold transition-all shadow-sm"
          >
            <BookOpen className="w-4 h-4" />
            <span>Resulting Codebook</span>
          </button>
        </div>

        {/* Narrative Dialogue Stage & 45s Timer */}
        <div className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col gap-2.5">
          {/* Top Row: Turn Indicator + 45s Timer */}
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <div className="flex items-center gap-1.5 text-zinc-300">
              <MessagesSquare className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-white font-bold">{stats.turnLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400 font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Time: {currentSeconds}s / 45s</span>
            </div>
          </div>

          {/* Progress Bar towards 56% Optimal Ceiling */}
          <div className="relative w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                stats.phase === 'consensus'
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : stats.phase === 'emerging'
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              }`}
              style={{ width: `${Math.min(100, (stats.accuracy / 0.56) * 100)}%` }}
            />
          </div>

          {/* Sub-status Row */}
          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
            <span>Baseline: 1.6%</span>
            <span className="text-zinc-200 font-bold">
              Communication Accuracy: <span className="text-sky-400 text-xs">{accPct}%</span>
            </span>
            <span className="text-purple-400 font-semibold">Target Ceiling: 56.0%</span>
          </div>

          {/* Completion Banner (Halts at 45s) */}
          {stats.isComplete && (
            <div className="p-2.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center justify-between animate-pulse">
              <span>🏆 Evaluation Complete at 45s: Final 56.0% consensus locked!</span>
              <button
                onClick={() => setIsCodebookOpen(true)}
                className="underline text-white hover:text-emerald-200 ml-2"
              >
                Inspect Resulting Codebook →
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Center Canvas (LIFE.gif Aesthetic) */}
      <main className="flex flex-col items-center my-3 relative">
        <GridCanvas
          grid={grid}
          viewMode={viewMode}
          showSynapses={showSynapses}
          visualEpoch={visualEpoch}
        />

        {/* Floating Gen & Agent Counter on canvas bottom */}
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none text-[11px] text-zinc-400 font-mono bg-black/75 backdrop-blur-sm px-3 py-1 rounded border border-zinc-800/80">
          <span>Gen #{stats.generation} (Turn {stats.subTurn}/3)</span>
          <span>Living Cells: {stats.aliveCount}</span>
          <span>Active Synapses: {stats.synapseCount}</span>
        </div>
      </main>

      {/* 3. Streamlined Controls Bar */}
      <footer className="w-full max-w-2xl flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
          {/* Playback Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (stats.isComplete) {
                  // If completed, restart from 0
                  restartWithPreset(() => PRESETS[0].load(grid));
                } else {
                  setIsRunning(!isRunning);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold transition-all ${
                isRunning
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
              }`}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isRunning ? 'Pause' : stats.isComplete ? 'Replay' : 'Play'}</span>
            </button>

            <button
              onClick={stepTurn}
              disabled={isRunning || stats.isComplete}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
            >
              <StepForward className="w-3.5 h-3.5" />
              <span>Step Turn</span>
            </button>

            <button
              onClick={() => restartWithPreset(() => PRESETS[0].load(grid))}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Restart Cosmos</span>
            </button>

            <button
              onClick={() => {
                setIsRunning(false);
                grid.clear();
                setVisualEpoch((e) => e + 1);
                setTick((t) => t + 1);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-rose-400"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

          {/* Visual Mode Toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === '1bit' ? 'dialect' : '1bit')}
              className="px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-zinc-500 text-[11px]"
            >
              {viewMode === '1bit' ? 'Mode: 1-Bit (LIFE.gif)' : 'Mode: Dialect Glow'}
            </button>

            <button
              onClick={() => setShowSynapses(!showSynapses)}
              className={`px-2 py-1.5 rounded border text-[11px] ${
                showSynapses
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-800'
              }`}
            >
              Synapses: {showSynapses ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Presets Row */}
        <div className="flex items-center justify-between gap-1 text-[11px] px-1 text-zinc-400">
          <div className="flex items-center gap-1 text-zinc-500">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Presets:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => restartWithPreset(() => p.load(grid))}
                className="px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 text-zinc-300 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
