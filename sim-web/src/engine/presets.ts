import { SimulationGrid } from './simulation.ts';

export interface PresetPattern {
  name: string;
  description: string;
  category: 'Universe' | 'Oscillator' | 'Spaceship' | 'Gun' | 'Soup';
  load: (grid: SimulationGrid) => void;
}

// Helper to spawn a classic 5-cell glider heading down-right
function spawnGlider(grid: SimulationGrid, x: number, y: number, color = 0, shape = 0) {
  const coords = [
    [1, 0],
    [2, 1],
    [0, 2], [1, 2], [2, 2],
  ];
  coords.forEach(([dx, dy]) => {
    grid.setCell(x + dx, y + dy, true, color, shape);
  });
}

// Helper to spawn a lightweight spaceship (LWSS) heading right
function spawnLWSS(grid: SimulationGrid, x: number, y: number, color = 1, shape = 1) {
  const coords = [
    [0, 1], [0, 3], [1, 0], [2, 0], [3, 0], [3, 3], [4, 0], [4, 1], [4, 2]
  ];
  coords.forEach(([dx, dy]) => {
    grid.setCell(x + dx, y + dy, true, color, shape);
  });
}

// Helper to spawn an ornate pulsating cloverleaf oscillator (Pulsar)
function spawnPulsar(grid: SimulationGrid, cx: number, cy: number, colorBase = 2) {
  const offsets = [
    [-6, -4], [-6, -3], [-6, -2], [-6, 2], [-6, 3], [-6, 4],
    [-1, -4], [-1, -3], [-1, -2], [-1, 2], [-1, 3], [-1, 4],
    [1, -4], [1, -3], [1, -2], [1, 2], [1, 3], [1, 4],
    [6, -4], [6, -3], [6, -2], [6, 2], [6, 3], [6, 4],
    // Transposed
    [-4, -6], [-3, -6], [-2, -6], [2, -6], [3, -6], [4, -6],
    [-4, -1], [-3, -1], [-2, -1], [2, -1], [3, -1], [4, -1],
    [-4, 1], [-3, 1], [-2, 1], [2, 1], [3, 1], [4, 1],
    [-4, 6], [-3, 6], [-2, 6], [2, 6], [3, 6], [4, 6],
  ];

  offsets.forEach(([dx, dy], i) => {
    grid.setCell(cx + dx, cy + dy, true, (colorBase + i) % 8, i % 8);
  });
}

// Helper to spawn a Gosper Glider Gun factory
function spawnGun(grid: SimulationGrid, ox: number, oy: number, color = 3) {
  const coords = [
    [1, 5], [1, 6], [2, 5], [2, 6],
    [11, 5], [11, 6], [11, 7], [12, 4], [12, 8], [13, 3], [13, 9],
    [14, 3], [14, 9], [15, 6], [16, 4], [16, 8], [17, 5], [17, 6], [17, 7], [18, 6],
    [21, 3], [21, 4], [21, 5], [22, 3], [22, 4], [22, 5], [23, 2], [23, 6],
    [25, 1], [25, 2], [25, 6], [25, 7],
    [35, 3], [35, 4], [36, 3], [36, 4],
  ];
  coords.forEach(([dx, dy], i) => {
    grid.setCell(ox + dx, oy + dy, true, (color + i) % 8, (i * 3) % 8);
  });
}

function spawnPyramid(grid: SimulationGrid, px: number, py: number) {
  for (let row = 0; row < 7; row++) {
    const halfW = 7 - row;
    for (let col = -halfW; col <= halfW; col += 2) {
      grid.setCell(px + col, py - row, true, row % 8, (col + 8) % 8);
    }
  }
  [-9, 9].forEach((wx) => {
    for (let y = -8; y <= 2; y += 2) {
      grid.setCell(px + wx, py + y, true, 3, 5);
    }
  });
  grid.setCell(px, py - 9, true, 0, 0);
  grid.setCell(px - 1, py - 9, true, 0, 1);
  grid.setCell(px + 1, py - 9, true, 0, 2);
}

function loadCosmosVariant(grid: SimulationGrid, variant: number) {
  grid.clear();
  
  if (variant === 0) {
    spawnGun(grid, 2, 2, 0);
    spawnPulsar(grid, 52, 12, 2);
    spawnPulsar(grid, 50, 32, 4);
    spawnPulsar(grid, 34, 18, 6);
    spawnPyramid(grid, 12, 46);
    spawnGlider(grid, 24, 20, 1, 2);
    spawnLWSS(grid, 34, 52, 1, 3);
  } else if (variant === 1) {
    spawnGun(grid, 2, 20, 1);
    spawnPulsar(grid, 40, 10, 3);
    spawnPulsar(grid, 54, 45, 5);
    spawnPyramid(grid, 32, 50);
    spawnGlider(grid, 10, 10, 2, 1);
    spawnLWSS(grid, 10, 50, 4, 3);
    spawnLWSS(grid, 10, 56, 4, 3);
  } else if (variant === 2) {
    spawnGun(grid, 20, 2, 2);
    spawnPulsar(grid, 12, 40, 0);
    spawnPulsar(grid, 48, 20, 1);
    spawnPyramid(grid, 48, 55);
    spawnGlider(grid, 5, 5, 3, 4);
    spawnLWSS(grid, 30, 10, 5, 6);
  } else {
    spawnGun(grid, 10, 10, 3);
    spawnPulsar(grid, 15, 50, 4);
    spawnPulsar(grid, 50, 15, 5);
    spawnPulsar(grid, 40, 40, 6);
    spawnPyramid(grid, 25, 30);
    spawnLWSS(grid, 5, 25, 7, 0);
  }
}

export const PRESETS: PresetPattern[] = [
  {
    name: 'Random Cosmos (4 Variants)',
    description: 'A random full canvas teeming with life, chosen from 4 variations.',
    category: 'Universe',
    load: (grid: SimulationGrid) => {
      loadCosmosVariant(grid, Math.floor(Math.random() * 4));
    },
  },
  {
    name: 'Gosper Glider Gun',
    description: 'A classic factory endlessly spawning gliders across the board.',
    category: 'Gun',
    load: (grid: SimulationGrid) => {
      grid.clear();
      spawnGun(grid, Math.floor(grid.width / 2) - 18, Math.floor(grid.height / 2) - 5, 0);
    },
  },
  {
    name: 'Symmetric Pulsar',
    description: 'A high-period pulsating geometric oscillator.',
    category: 'Oscillator',
    load: (grid: SimulationGrid) => {
      grid.clear();
      spawnPulsar(grid, Math.floor(grid.width / 2), Math.floor(grid.height / 2), 2);
    },
  },
  {
    name: 'Spaceship Fleet',
    description: 'Multiple spaceships cruising across the screen.',
    category: 'Spaceship',
    load: (grid: SimulationGrid) => {
      grid.clear();
      spawnLWSS(grid, 6, 12, 0, 1);
      spawnLWSS(grid, 6, 28, 2, 4);
      spawnLWSS(grid, 6, 44, 4, 6);
      spawnLWSS(grid, 24, 20, 6, 2);
    },
  },
  {
    name: 'Full Primordial Soup',
    description: 'A dense, full-canvas ecosystem of communicative agents across all quadrants.',
    category: 'Soup',
    load: (grid: SimulationGrid) => {
      grid.randomize(0.28);
    },
  },
];
