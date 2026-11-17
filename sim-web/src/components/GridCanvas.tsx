import React, { useRef, useEffect } from 'react';
import { SimulationGrid } from '../engine/simulation.ts';
import { TOKEN_COLORS } from '../engine/constants.ts';

interface GridCanvasProps {
  grid: SimulationGrid;
  viewMode: '1bit' | 'dialect';
  showSynapses: boolean;
  /** Bump on clear / restart / preset load to snap visuals to the new grid. */
  visualEpoch: number;
}

interface CellVisual {
  intensity: number;
  scale: number;
  trail: number;
  ghost: number; // death-only smear, independent of intensity
  flash: number;
  jitter: number;
  aliveTarget: boolean;
  agePhase: number;
}

/** Birth punch */
const BIRTH_SCALE_PEAK = 1.45;
const BIRTH_SCALE_SETTLE = 1.0;
/** Death collapse */
const DEATH_SCALE_END = 0.12;
/** Solid discs that nearly touch — no bloom */
const CORE_RADIUS = 0.86;
const SYNAPSE_PULSE_DECAY = 1 / 0.4;
/** Explicit phosphor trail (framebuffer is hard-cleared to avoid washout) */
const TRAIL_DECAY_DEAD = 0.55; // ~1.5s smear — readable death
const TRAIL_DECAY_ALIVE = 1.4;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function makeVisuals(count: number): CellVisual[] {
  return Array.from({ length: count }, () => ({
    intensity: 0,
    scale: 0,
    trail: 0,
    ghost: 0,
    flash: 0,
    jitter: 0,
    aliveTarget: false,
    agePhase: Math.random() * Math.PI * 2,
  }));
}

function snapVisualsToGrid(grid: SimulationGrid, visuals: CellVisual[]) {
  const n = grid.width * grid.height;
  for (let i = 0; i < n; i++) {
    const alive = grid.cells[i].alive;
    visuals[i].aliveTarget = alive;
    visuals[i].intensity = alive ? 1 : 0;
    visuals[i].scale = alive ? BIRTH_SCALE_SETTLE : 0;
    visuals[i].trail = 0;
    visuals[i].ghost = 0;
    visuals[i].flash = 0;
    visuals[i].jitter = 0;
  }
}

function approach(current: number, target: number, rate: number, dt: number): number {
  const t = 1 - Math.exp(-rate * dt);
  return current + (target - current) * t;
}

export const GridCanvas: React.FC<GridCanvasProps> = ({
  grid,
  viewMode,
  showSynapses,
  visualEpoch,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMouseDownRef = useRef(false);
  const lastDrawnCellRef = useRef<string | null>(null);

  const visualsRef = useRef<CellVisual[]>(makeVisuals(grid.width * grid.height));
  const lastTimeRef = useRef<number>(performance.now());
  const lastSubTurnRef = useRef<number>(grid.stats.subTurn);
  const lastGenRef = useRef<number>(grid.stats.generation);
  const synapsePulseRef = useRef<number>(1);
  const genFlashRef = useRef<number>(0);
  const noisePhaseRef = useRef<number>(0);

  useEffect(() => {
    if (visualsRef.current.length !== grid.width * grid.height) {
      visualsRef.current = makeVisuals(grid.width * grid.height);
    }
    snapVisualsToGrid(grid, visualsRef.current);
    lastSubTurnRef.current = grid.stats.subTurn;
    lastGenRef.current = grid.stats.generation;
    synapsePulseRef.current = 1;
    genFlashRef.current = 0;

    // Hard wipe on reset so phosphor ghosts don't linger from the old cosmos
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [visualEpoch, grid.width, grid.height]);

  useEffect(() => {
    let raf = 0;

    const renderLoop = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        raf = requestAnimationFrame(renderLoop);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        raf = requestAnimationFrame(renderLoop);
        return;
      }

      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      noisePhaseRef.current += dt;

      const w = grid.width;
      const h = grid.height;
      const visuals = visualsRef.current;
      const cells = grid.cells;

      // Generation flip → global glitch flash + per-cell birth/death punches
      const genChanged = grid.stats.generation !== lastGenRef.current;
      const subChanged = grid.stats.subTurn !== lastSubTurnRef.current;
      if (genChanged || subChanged) {
        lastSubTurnRef.current = grid.stats.subTurn;
        lastGenRef.current = grid.stats.generation;
        synapsePulseRef.current = 1;
        if (genChanged) {
          genFlashRef.current = 1;
        }
      } else {
        synapsePulseRef.current = Math.max(
          0.22,
          synapsePulseRef.current - SYNAPSE_PULSE_DECAY * dt
        );
        genFlashRef.current = Math.max(0, genFlashRef.current - dt * 3.2);
      }

      for (let i = 0; i < w * h; i++) {
        const alive = cells[i].alive;
        const v = visuals[i];
        v.agePhase += dt * (2.2 + (i % 7) * 0.15);

        if (alive !== v.aliveTarget) {
          if (alive) {
            // BIRTH — hard pop in, overshoot scale, white flash
            v.intensity = 1.2;
            v.scale = 0.02;
            v.flash = 1;
            v.jitter = 1;
            v.trail = Math.max(v.trail, 0.55);
          } else {
            // DEATH — flash + long ghost smear (LIFE.gif phosphor)
            v.flash = 1;
            v.jitter = 1;
            v.trail = 1.2;
            v.ghost = 1;
            v.intensity = 0.9;
            v.scale = Math.max(v.scale, BIRTH_SCALE_PEAK);
          }
          v.aliveTarget = alive;
        }

        if (alive) {
          v.intensity = approach(v.intensity, 1, 14, dt);
          // Punch scale up to peak then settle
          const scaleTarget =
            v.flash > 0.35 ? BIRTH_SCALE_PEAK : BIRTH_SCALE_SETTLE;
          v.scale = approach(v.scale, scaleTarget, v.flash > 0.2 ? 18 : 10, dt);
          // Living shimmer / glitch from miscommunication
          const glitch = cells[i].glitch || 0;
          const shimmer =
            0.04 * Math.sin(v.agePhase) + glitch * 0.12 * Math.sin(v.agePhase * 7.3);
          v.intensity = Math.min(1.15, Math.max(0.75, v.intensity + shimmer * dt * 8));
          v.ghost = Math.max(0, v.ghost - dt * 2.5);
        } else {
          // Slow intensity death so the smear reads; scale collapses a bit faster
          v.intensity = approach(v.intensity, 0, 4.2, dt);
          v.scale = approach(v.scale, DEATH_SCALE_END, 6.5, dt);
          v.ghost = Math.max(0, v.ghost - dt * TRAIL_DECAY_DEAD);
        }

        v.flash = Math.max(0, v.flash - dt * 3.8);
        v.jitter = Math.max(0, v.jitter - dt * 4.8);
        v.trail = Math.max(0, v.trail - dt * (alive ? TRAIL_DECAY_ALIVE : TRAIL_DECAY_DEAD));

        if (v.intensity < 0.01) v.intensity = 0;
        if (v.trail < 0.01) v.trail = 0;
        if (v.ghost < 0.01) v.ghost = 0;
        if (!alive && v.intensity === 0 && v.trail === 0 && v.ghost === 0) v.scale = 0;
      }

      const width = canvas.width;
      const height = canvas.height;
      const cellW = width / w;
      const cellH = height / h;
      const minCell = Math.min(cellW, cellH);

      // 1. Hard clear — trails are explicit per-cell (avoids additive washout fog)
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Generation glitch bar flash
      if (genFlashRef.current > 0.02) {
        ctx.fillStyle = `rgba(255,255,255,${0.045 * genFlashRef.current})`;
        ctx.fillRect(0, 0, width, height);
        // A few horizontal tear lines
        const tears = 3 + Math.floor(genFlashRef.current * 4);
        for (let t = 0; t < tears; t++) {
          const ty =
            ((noisePhaseRef.current * 90 + t * 137.17) % 1) * height;
          ctx.fillStyle = `rgba(255,255,255,${0.08 * genFlashRef.current})`;
          ctx.fillRect(0, ty, width, 1 + genFlashRef.current * 2);
        }
      }

      // 2. Faint scan lattice
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= w; x += 2) {
        ctx.beginPath();
        ctx.moveTo(x * cellW, 0);
        ctx.lineTo(x * cellW, height);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += 2) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellH);
        ctx.lineTo(width, y * cellH);
        ctx.stroke();
      }

      // 3. Synapses
      if (showSynapses && grid.synapses.length > 0) {
        const pulse = synapsePulseRef.current;
        const modeMul = viewMode === '1bit' ? 0.18 : 1;
        for (const syn of grid.synapses) {
          const sx = (syn.x1 + 0.5) * cellW;
          const sy = (syn.y1 + 0.5) * cellH;
          const tx = (syn.x2 + 0.5) * cellW;
          const ty = (syn.y2 + 0.5) * cellH;

          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);

          if (syn.direction === 'outbound') {
            if (viewMode === '1bit') {
              ctx.strokeStyle = `rgba(255,255,255,${0.3 * pulse * modeMul})`;
            } else {
              const [r, g, b] = hexToRgb(TOKEN_COLORS[syn.token]);
              ctx.strokeStyle = `rgba(${r},${g},${b},${0.55 * pulse})`;
            }
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
          } else if (syn.direction === 'inbound') {
            ctx.strokeStyle = `rgba(168, 85, 247,${0.4 * pulse * modeMul})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
          } else {
            if (viewMode === '1bit') {
              ctx.strokeStyle = `rgba(255,255,255,${0.45 * pulse * modeMul})`;
            } else {
              const [r, g, b] = hexToRgb(TOKEN_COLORS[syn.token]);
              ctx.strokeStyle = `rgba(${r},${g},${b},${0.85 * pulse})`;
            }
            ctx.lineWidth = 1.4;
            ctx.setLineDash([]);
          }

          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // 4. Solid cells — no bloom. Birth/death still punch scale + fade + glitch.
      ctx.globalCompositeOperation = 'source-over';
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          const v = visuals[idx];
          const drawStrength = Math.max(v.intensity, v.trail * 0.9, v.ghost * 0.75);
          if (drawStrength < 0.02 && v.flash < 0.02) continue;

          const jx =
            v.jitter > 0
              ? (Math.sin(v.agePhase * 19.1) * 0.28 + Math.sin(v.agePhase * 41.3) * 0.16) *
                v.jitter *
                minCell
              : 0;
          const jy =
            v.jitter > 0
              ? (Math.cos(v.agePhase * 17.7) * 0.28 + Math.sin(v.agePhase * 37.9) * 0.14) *
                v.jitter *
                minCell
              : 0;

          const cx = (x + 0.5) * cellW + jx;
          const cy = (y + 0.5) * cellH + jy;
          const scale = Math.max(
            v.scale,
            v.trail * 0.8,
            v.ghost * 0.9,
            v.flash * 0.45
          );
          if (scale < 0.04) continue;

          let [cr, cg, cb] = [255, 255, 255];
          if (viewMode === 'dialect') {
            [cr, cg, cb] = hexToRgb(TOKEN_COLORS[cells[idx].emittedToken] || '#ffffff');
          }

          const radius = Math.max(0.4, (minCell * CORE_RADIUS * scale) / 2);
          const alpha = Math.min(1, drawStrength * 1.05 + v.flash * 0.5);

          ctx.globalAlpha = alpha;
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();

          // Birth/death spark — hard fleck + brief RGB tear (glitch, not glow)
          if (v.flash > 0.12) {
            ctx.globalAlpha = v.flash;
            const spark = minCell * 0.32 * (0.5 + v.flash);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx - spark / 2, cy - spark / 2, spark, spark);
            ctx.globalAlpha = v.flash * 0.55;
            ctx.fillStyle = '#ff5577';
            ctx.fillRect(cx - spark / 2 - 1.5, cy - spark / 2, spark * 0.65, spark * 0.65);
            ctx.fillStyle = '#55ffcc';
            ctx.fillRect(cx - spark / 2 + 1.5, cy - spark / 2, spark * 0.65, spark * 0.65);
          }
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      raf = requestAnimationFrame(renderLoop);
    };

    raf = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(raf);
  }, [grid, viewMode, showSynapses]);

  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>, isClick = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const cellX = Math.floor(mouseX / (canvas.width / grid.width));
    const cellY = Math.floor(mouseY / (canvas.height / grid.height));

    if (cellX >= 0 && cellX < grid.width && cellY >= 0 && cellY < grid.height) {
      const key = `${cellX},${cellY}`;
      if (isClick || (isMouseDownRef.current && lastDrawnCellRef.current !== key)) {
        lastDrawnCellRef.current = key;
        grid.toggleCell(cellX, cellY);
      }
    }
  };

  return (
    <div className="relative inline-block border border-zinc-800 rounded-lg overflow-hidden shadow-2xl bg-black">
      <canvas
        ref={canvasRef}
        width={512}
        height={512}
        className="block cursor-crosshair pixelated max-w-full h-auto aspect-square"
        onPointerDown={(e) => {
          isMouseDownRef.current = true;
          handlePointer(e, true);
        }}
        onPointerMove={(e) => {
          if (isMouseDownRef.current) {
            handlePointer(e, false);
          }
        }}
        onPointerUp={() => {
          isMouseDownRef.current = false;
          lastDrawnCellRef.current = null;
        }}
        onPointerLeave={() => {
          isMouseDownRef.current = false;
          lastDrawnCellRef.current = null;
        }}
      />
    </div>
  );
};
