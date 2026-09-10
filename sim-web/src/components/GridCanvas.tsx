import React, { useRef, useEffect, useMemo } from 'react';
import { SimulationGrid } from '../engine/simulation.ts';
import { TOKEN_COLORS } from '../engine/constants.ts';
import { animate as anime } from 'animejs';

interface GridCanvasProps {
  grid: SimulationGrid;
  viewMode: '1bit' | 'dialect';
  showSynapses: boolean;
}

export const GridCanvas: React.FC<GridCanvasProps> = ({ grid, viewMode, showSynapses }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMouseDownRef = useRef(false);
  const lastDrawnCellRef = useRef<string | null>(null);

  // Maintain cell animations state for Anime.js
  const cellAnims = useMemo(() => {
    return Array.from({ length: grid.width * grid.height }).map(() => ({
      scale: 0,
      opacity: 0,
    }));
  }, [grid.width, grid.height]);

  // Track previous alive states to trigger animations on diffs
  const prevAliveRef = useRef<boolean[]>(
    Array.from({ length: grid.width * grid.height }).map(() => false)
  );

  // Sync cell logic state changes to Anime.js targets
  useEffect(() => {
    // Only run diffs if evaluation is not complete, ensuring animations halt naturally at 45s.
    // If it's complete, wait for the animations to finish settling.
    if (grid.stats.isComplete) return;

    const w = grid.width;
    const h = grid.height;
    const prev = prevAliveRef.current;

    for (let i = 0; i < w * h; i++) {
      const isAlive = grid.cells[i].alive;
      if (isAlive !== prev[i]) {
        prev[i] = isAlive;
        
        // Remove any existing animation for this cell
        // remove(cellAnims[i]);
        
        if (isAlive) {
          // Cell Birth
          anime(
            cellAnims[i], {
            scale: 1,
            opacity: 1,
            duration: 350,
            easing: 'easeOutBack',
          });
        } else {
          // Cell Death
          anime(
            cellAnims[i], {
            scale: 0,
            opacity: 0,
            duration: 350,
            easing: 'easeOutQuad',
          });
        }
      }
    }
  }, [grid.stats.subTurn, grid.stats.generation]); // Run diff logic when the grid updates internally

  // Continuous 60 FPS Render Loop
  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          const cellW = width / grid.width;
          const cellH = height / grid.height;

          // 1. Black background
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);

          // 2. Subtle retro scanline grid
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
          ctx.lineWidth = 0.5;
          for (let x = 0; x <= grid.width; x += 2) {
            ctx.beginPath();
            ctx.moveTo(x * cellW, 0);
            ctx.lineTo(x * cellW, height);
            ctx.stroke();
          }
          for (let y = 0; y <= grid.height; y += 2) {
            ctx.beginPath();
            ctx.moveTo(0, y * cellH);
            ctx.lineTo(width, y * cellH);
            ctx.stroke();
          }

          // 3. Render Synaptic Dialogue Beams
          if (showSynapses && grid.synapses.length > 0) {
            for (const syn of grid.synapses) {
              const sx = (syn.x1 + 0.5) * cellW;
              const sy = (syn.y1 + 0.5) * cellH;
              const tx = (syn.x2 + 0.5) * cellW;
              const ty = (syn.y2 + 0.5) * cellH;

              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(tx, ty);

              if (syn.direction === 'outbound') {
                ctx.strokeStyle = viewMode === '1bit' ? 'rgba(255, 255, 255, 0.3)' : TOKEN_COLORS[syn.token] + '99';
                ctx.lineWidth = 1;
              } else if (syn.direction === 'inbound') {
                ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
              } else {
                ctx.strokeStyle = viewMode === '1bit' ? 'rgba(255, 255, 255, 0.6)' : TOKEN_COLORS[syn.token];
                ctx.lineWidth = 1.5;
                ctx.setLineDash([]);
              }

              ctx.stroke();
              ctx.setLineDash([]);
            }
          }

          // 4. Render Cellular Grid (Authentic Game of Life Anime.js Dots)
          const w = grid.width;
          const h = grid.height;
          
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = y * w + x;
              const cell = grid.getCell(x, y);
              const anim = cellAnims[idx];
              
              if (anim.scale > 0.01 || anim.opacity > 0.01) {
                const px = x * cellW;
                const py = y * cellH;
                const maxRadius = Math.min(cellW, cellH) / 2;
                // Add a small gap factor (0.45) to separate pixels visually like authentic dots
                const currentRadius = Math.max(0, maxRadius * anim.scale * 0.45);

                ctx.beginPath();
                ctx.arc(px + cellW / 2, py + cellH / 2, currentRadius, 0, Math.PI * 2);

                ctx.globalAlpha = anim.opacity;
                if (viewMode === '1bit') {
                  ctx.fillStyle = '#ffffff';
                } else {
                  ctx.fillStyle = TOKEN_COLORS[cell.emittedToken] || '#ffffff';
                }
                ctx.fill();
                ctx.globalAlpha = 1.0;
              } else if (cell.fade > 0.04) {
                // Secondary decay ghosting (from previous grid logic)
                const px = x * cellW;
                const py = y * cellH;
                const maxRadius = Math.min(cellW, cellH) / 2;
                
                ctx.beginPath();
                ctx.arc(px + cellW / 2, py + cellH / 2, maxRadius * 0.45, 0, Math.PI * 2);
                ctx.globalAlpha = cell.fade * 0.2;
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.globalAlpha = 1.0;
              }
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [grid, viewMode, showSynapses, cellAnims]);

  // Click & drag interaction to draw cells
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
        
        // Ensure manual toggle triggers immediate anime state update for better interaction feel
        const idx = cellY * grid.width + cellX;
        const isAlive = grid.cells[idx].alive;
        prevAliveRef.current[idx] = isAlive;
        
        // remove(cellAnims[idx]);
        if (isAlive) {
          anime(
            cellAnims[idx], {
            scale: 1,
            opacity: 1,
            duration: 350,
            easing: 'easeOutBack',
          });
        } else {
          anime(
            cellAnims[idx], {
            scale: 0,
            opacity: 0,
            duration: 350,
            easing: 'easeOutQuad',
          });
        }
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
