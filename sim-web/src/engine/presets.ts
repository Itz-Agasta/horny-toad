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

function stamp(grid: SimulationGrid, x: number, y: number, color = 0, shape = 0) {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return;
  grid.setCell(x, y, true, color, shape);
}

function carveRect(
  grid: SimulationGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number
) {
  const xa = Math.max(0, Math.min(x0, x1));
  const xb = Math.min(grid.width - 1, Math.max(x0, x1));
  const ya = Math.max(0, Math.min(y0, y1));
  const yb = Math.min(grid.height - 1, Math.max(y0, y1));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      grid.setCell(x, y, false);
    }
  }
}

/** LIFE.gif doodle: hatched pyramid "temple" with curly antennae and a hanging stem. */
function spawnLifeDoodle(grid: SimulationGrid, cx: number, baseY: number) {
  const height = 18;
  const baseW = 30;

  carveRect(grid, cx - baseW / 2 - 8, baseY - height - 10, cx + baseW / 2 + 8, baseY + 12);

  // Solid hatched triangle (peak up) — every row filled so it reads as LIFE.gif stripes
  for (let row = 0; row < height; row++) {
    const t = row / (height - 1);
    const half = Math.round((baseW / 2) * t);
    const y = baseY - (height - 1) + row;
    for (let x = -half; x <= half; x++) {
      stamp(grid, cx + x, y, row % 8, (x + 16) % 8);
    }
  }

  // Peak cap
  stamp(grid, cx, baseY - height, 0, 0);
  stamp(grid, cx - 1, baseY - height, 0, 1);
  stamp(grid, cx + 1, baseY - height, 0, 2);
  stamp(grid, cx, baseY - height - 1, 0, 3);

  // Curly antennae off the peak (left / right)
  for (let i = 0; i < 10; i++) {
    const ly = baseY - height + 2 - Math.floor(i * 0.45);
    const lx = cx - 4 - i + Math.round(Math.sin(i * 0.7) * 2);
    stamp(grid, lx, ly, 3, i % 8);
    stamp(grid, lx, ly + 1, 3, i % 8);

    const ry = baseY - height + 2 - Math.floor(i * 0.45);
    const rx = cx + 4 + i - Math.round(Math.sin(i * 0.7) * 2);
    stamp(grid, rx, ry, 4, i % 8);
    stamp(grid, rx, ry + 1, 4, i % 8);
  }

  // Fringe along the base
  const halfBase = Math.floor(baseW / 2);
  for (let x = -halfBase; x <= halfBase; x += 2) {
    stamp(grid, cx + x, baseY + 1, 5, 2);
  }

  // Hanging chandelier stem
  const stemX = cx;
  for (let dy = 2; dy <= 8; dy++) {
    stamp(grid, stemX, baseY + dy, 6, dy % 8);
    if (dy % 2 === 0) {
      stamp(grid, stemX - 1, baseY + dy, 6, 1);
      stamp(grid, stemX + 1, baseY + dy, 6, 2);
    }
  }
  // Stem ornaments
  for (const [dx, dy] of [
    [-2, 4],
    [2, 4],
    [-3, 6],
    [3, 6],
    [-2, 8],
    [2, 8],
    [0, 9],
    [-1, 9],
    [1, 9],
  ]) {
    stamp(grid, stemX + dx, baseY + dy, 7, 4);
  }
}

function spawnDiamond(grid: SimulationGrid, cx: number, cy: number, r = 3) {
  for (let y = -r; y <= r; y++) {
    const half = r - Math.abs(y);
    stamp(grid, cx - half, cy + y, 2, 1);
    stamp(grid, cx + half, cy + y, 2, 1);
    if (half >= 1) {
      stamp(grid, cx - half + 1, cy + y, 2, 2);
      stamp(grid, cx + half - 1, cy + y, 2, 2);
    }
  }
}

function loadCosmosVariant(grid: SimulationGrid, variant: number) {
  // Dense soup in the upper field, then the LIFE.gif temple doodle as the landmark
  grid.randomize(0.22);

  if (variant === 0) {
    spawnGun(grid, 2, 2, 0);
    spawnPulsar(grid, 52, 12, 2);
    spawnPulsar(grid, 48, 28, 4);
    spawnGlider(grid, 30, 8, 1, 2);
    spawnLWSS(grid, 40, 6, 1, 3);
    spawnLifeDoodle(grid, 20, 50);
    spawnDiamond(grid, 44, 42, 3);
    spawnDiamond(grid, 54, 38, 3);
  } else if (variant === 1) {
    spawnGun(grid, 28, 2, 1);
    spawnPulsar(grid, 10, 10, 3);
    spawnGlider(grid, 50, 8, 2, 1);
    spawnLWSS(grid, 4, 20, 4, 3);
    spawnLifeDoodle(grid, 22, 52);
    spawnDiamond(grid, 48, 40, 4);
    spawnDiamond(grid, 58, 48, 3);
  } else if (variant === 2) {
    spawnPulsar(grid, 12, 12, 0);
    spawnPulsar(grid, 50, 10, 1);
    spawnGlider(grid, 5, 5, 3, 4);
    spawnLWSS(grid, 36, 8, 5, 6);
    spawnLifeDoodle(grid, 24, 50);
    spawnDiamond(grid, 50, 36, 3);
    spawnDiamond(grid, 58, 44, 3);
  } else {
    spawnGun(grid, 8, 2, 3);
    spawnPulsar(grid, 50, 14, 5);
    spawnLWSS(grid, 4, 18, 7, 0);
    spawnLifeDoodle(grid, 18, 51);
    spawnDiamond(grid, 42, 38, 3);
    spawnDiamond(grid, 52, 46, 4);
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
    name: 'LIFE.gif Temple',
    description: 'The hatched pyramid doodle from LIFE.gif, evolving in a sparse field.',
    category: 'Universe',
    load: (grid: SimulationGrid) => {
      grid.clear();
      spawnLifeDoodle(grid, 24, 48);
      spawnDiamond(grid, 48, 36, 3);
      spawnDiamond(grid, 56, 44, 3);
      spawnGlider(grid, 50, 8, 1, 2);
      spawnLWSS(grid, 8, 10, 2, 3);
    },
  },
  {
    name: 'Full Primordial Soup',
    description: 'A dense, full-canvas ecosystem of communicative agents across all quadrants.',
    category: 'Soup',
    load: (grid: SimulationGrid) => {
      grid.randomize(0.26);
      spawnLifeDoodle(grid, 22, 50);
      spawnDiamond(grid, 48, 40, 3);
    },
  },
];
