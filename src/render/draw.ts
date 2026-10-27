import type { BuildingId } from '../sim/buildings';

export const TERRAIN_COLORS = ['#1d5c88', '#3a8db5', '#679a82', '#d8c18c', '#a6ad66', '#4d7a38', '#8f877a'];

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/** Stable pseudo-random value in [0, 1) for a tile. */
export function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Neighbor mask bits for linear structures (causeway, dike). */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

function linear(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, mask: number, w: number, dark: string, light: string) {
  const a = (0.5 - w / 2) * s;
  const b = (0.5 + w / 2) * s;
  const pieces: [number, number, number, number][] = [[a, a, b - a, b - a]];
  if (mask & N) pieces.push([a, 0, b - a, a + 1]);
  if (mask & S) pieces.push([a, b - 1, b - a, s - b + 1]);
  if (mask & W) pieces.push([0, a, a + 1, b - a]);
  if (mask & E) pieces.push([b - 1, a, s - b + 1, b - a]);
  ctx.fillStyle = dark;
  for (const [px, py, pw, ph] of pieces) ctx.fillRect(x + px, y + py, pw, ph);
  const inset = Math.max(1, s / 16);
  ctx.fillStyle = light;
  for (const [px, py, pw, ph] of pieces) {
    const l = px === a ? inset : 0;
    const t = py === a ? inset : 0;
    const r = px + pw >= b - 1 && px <= a ? inset : 0;
    const btm = py + ph >= b - 1 && py <= a ? inset : 0;
    ctx.fillRect(x + px + l, y + py + t, pw - l - r, ph - t - btm);
  }
}

export function drawBuilding(ctx: CanvasRenderingContext2D, id: BuildingId, x: number, y: number, s: number, v = 0, mask = N | E | S | W) {
  const p = (f: number) => f * s;
  const line = Math.max(1, s / 24);
  ctx.lineWidth = line;
  switch (id) {
    case 'calli': {
      ctx.fillStyle = 'rgba(40,25,10,0.3)';
      ctx.fillRect(x + p(0.2), y + p(0.22), p(0.72), p(0.7));
      ctx.fillStyle = v < 0.5 ? '#f2e7cf' : '#e9d6b1';
      ctx.fillRect(x + p(0.12), y + p(0.14), p(0.72), p(0.7));
      ctx.strokeStyle = '#8a6a44';
      ctx.strokeRect(x + p(0.12), y + p(0.14), p(0.72), p(0.7));
      ctx.fillStyle = v < 0.33 ? '#b5432b' : v < 0.66 ? '#1f8f88' : '#c98a1f';
      ctx.fillRect(x + p(0.12), y + p(0.14), p(0.72), p(0.11));
      ctx.fillStyle = '#4a3220';
      ctx.fillRect(x + p(0.4), y + p(0.56), p(0.16), p(0.28));
      break;
    }
    case 'chinampa': {
      ctx.fillStyle = '#7b6a3c';
      ctx.fillRect(x + p(0.06), y + p(0.06), p(0.88), p(0.88));
      const flowers = v > 0.85;
      ctx.fillStyle = flowers ? '#6c9a3a' : '#5a9a38';
      ctx.fillRect(x + p(0.1), y + p(0.1), p(0.8), p(0.8));
      ctx.fillStyle = flowers ? '#f0961c' : '#3f7a26';
      for (let r = 0; r < 4; r++) ctx.fillRect(x + p(0.16), y + p(0.18 + r * 0.18), p(0.68), p(0.06));
      ctx.fillStyle = '#2d5520';
      ctx.beginPath();
      ctx.arc(x + p(0.14), y + p(0.14), p(0.09), 0, Math.PI * 2);
      ctx.arc(x + p(0.86), y + p(0.86), p(0.09), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'calzada':
      linear(ctx, x, y, s, mask, 0.6, '#8f836a', '#d2c6a6');
      break;
    case 'albarradon': {
      linear(ctx, x, y, s, mask, 0.32, '#3b2a18', '#6b4b2c');
      ctx.fillStyle = '#2a1d10';
      ctx.beginPath();
      ctx.arc(x + p(0.5), y + p(0.5), p(0.08), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'lenadores': {
      ctx.fillStyle = '#9a8655';
      ctx.beginPath();
      ctx.ellipse(x + p(0.5), y + p(0.55), p(0.44), p(0.38), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a4f2a';
      ctx.beginPath();
      ctx.moveTo(x + p(0.14), y + p(0.56));
      ctx.lineTo(x + p(0.38), y + p(0.16));
      ctx.lineTo(x + p(0.62), y + p(0.56));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4a2f18';
      ctx.fillRect(x + p(0.33), y + p(0.4), p(0.1), p(0.16));
      ctx.fillStyle = '#c49a6c';
      ctx.strokeStyle = '#6e4826';
      for (const [cx, cy] of [[0.66, 0.68], [0.82, 0.68], [0.74, 0.54]]) {
        ctx.beginPath();
        ctx.arc(x + p(cx), y + p(cy), p(0.08), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'cantera': {
      ctx.fillStyle = '#5f594f';
      ctx.fillRect(x + p(0.12), y + p(0.1), p(0.5), p(0.4));
      ctx.fillStyle = '#c9c1b2';
      ctx.strokeStyle = '#6f685c';
      for (const [bx, by] of [[0.18, 0.58], [0.5, 0.58], [0.34, 0.36], [0.62, 0.3]]) {
        ctx.fillRect(x + p(bx), y + p(by), p(0.28), p(0.2));
        ctx.strokeRect(x + p(bx), y + p(by), p(0.28), p(0.2));
      }
      break;
    }
    case 'tianguis': {
      ctx.fillStyle = '#e6d3a3';
      ctx.fillRect(x + p(0.04), y + p(0.04), p(0.92), p(0.92));
      const colors = ['#b5432b', '#e0a526', '#1f8f88', '#7d3c98'];
      colors.forEach((c, i) => {
        const bx = x + p(0.1 + (i % 2) * 0.42);
        const by = y + p(0.1 + Math.floor(i / 2) * 0.42);
        ctx.fillStyle = 'rgba(40,25,10,0.25)';
        ctx.fillRect(bx + p(0.04), by + p(0.05), p(0.36), p(0.36));
        ctx.fillStyle = c;
        ctx.fillRect(bx, by, p(0.36), p(0.36));
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(bx, by + p(0.12), p(0.36), p(0.08));
      });
      break;
    }
    case 'teocalli': {
      ctx.fillStyle = 'rgba(40,25,10,0.3)';
      ctx.fillRect(x + p(0.12), y + p(0.4), p(0.86), p(0.58));
      const layers: [number, number, number, number, string][] = [
        [0.06, 0.38, 0.88, 0.56, '#b3a582'],
        [0.15, 0.27, 0.7, 0.5, '#c6b994'],
        [0.24, 0.17, 0.52, 0.42, '#d8cdae'],
      ];
      for (const [lx, ly, lw, lh, c] of layers) {
        ctx.fillStyle = c;
        ctx.fillRect(x + p(lx), y + p(ly), p(lw), p(lh));
        ctx.strokeStyle = '#857858';
        ctx.strokeRect(x + p(lx), y + p(ly), p(lw), p(lh));
      }
      ctx.fillStyle = '#8f8263';
      ctx.fillRect(x + p(0.44), y + p(0.4), p(0.12), p(0.54));
      ctx.fillStyle = '#b5432b';
      ctx.fillRect(x + p(0.27), y + p(0.05), p(0.19), p(0.18));
      ctx.fillStyle = '#2f6fa8';
      ctx.fillRect(x + p(0.54), y + p(0.05), p(0.19), p(0.18));
      break;
    }
  }
}
