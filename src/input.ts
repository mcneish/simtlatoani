import type { Game } from './game';
import { BUILD_ORDER } from './sim/buildings';

const PAN_SPEED = 700; // screen px per second

/** Mouse and keyboard handling for the map. */
export function attachInput(game: Game, canvas: HTMLCanvasElement) {
  let mode: 'none' | 'pan' | 'paint' | 'erase' = 'none';
  let lastX = 0;
  let lastY = 0;
  let lastTile: { x: number; y: number } | null = null;
  const keys = new Set<string>();

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    if (!game.state || game.ui.modalOpen) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events (demo cursor) have no capturable pointer.
    }
    lastX = e.clientX;
    lastY = e.clientY;
    const tile = game.screenToTile(e.clientX, e.clientY);
    lastTile = tile;
    game.beginStroke();
    if (e.button === 1 || (e.button === 0 && !game.tool)) mode = 'pan';
    else if (e.button === 2 || (e.button === 0 && game.tool === 'demoler')) {
      mode = 'erase';
      game.demolishAt(tile.x, tile.y, false);
    } else if (e.button === 0) {
      mode = 'paint';
      game.tryPlace(tile.x, tile.y, false);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const tile = game.screenToTile(e.clientX, e.clientY);
    game.hoverTile = tile;
    if (mode === 'pan') {
      game.panBy(lastX - e.clientX, lastY - e.clientY);
    } else if ((mode === 'paint' || mode === 'erase') && lastTile && (tile.x !== lastTile.x || tile.y !== lastTile.y)) {
      for (const p of line(lastTile, tile).slice(1)) {
        if (mode === 'paint') game.tryPlace(p.x, p.y, true);
        else game.demolishAt(p.x, p.y, true);
      }
      lastTile = tile;
    }
    lastX = e.clientX;
    lastY = e.clientY;
  });

  const end = () => {
    mode = 'none';
    lastTile = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => {
    if (mode === 'none') game.hoverTile = null;
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      game.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false },
  );

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      game.escape();
      return;
    }
    if (!game.state || game.ui.modalOpen) return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      e.preventDefault();
      game.togglePause();
    } else if (/^[1-8]$/.test(k)) game.selectTool(BUILD_ORDER[Number(k) - 1]);
    else if (k === '9') game.selectTool('demoler');
    else keys.add(k);
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  return {
    update(dt: number) {
      if (!game.state || game.ui.modalOpen) return;
      let dx = 0;
      let dy = 0;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;
      if (keys.has('w') || keys.has('arrowup')) dy -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dy += 1;
      if (dx || dy) game.panBy((dx * PAN_SPEED * dt) / 1000, (dy * PAN_SPEED * dt) / 1000);
    },
  };
}

/** Bresenham line between two tiles, inclusive. */
function line(a: { x: number; y: number }, b: { x: number; y: number }) {
  const out: { x: number; y: number }[] = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - x);
  const dy = -Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1;
  const sy = y < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push({ x, y });
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}
