import { mulberry32 } from './rng';
import { T, type Terrain } from './terrain';

export const MAP_SIZE = 56;

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Bilinear value noise in [0, 1]. */
function makeNoise(rand: () => number, w: number, h: number, cell: number) {
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const grid = Array.from({ length: gw * gh }, rand);
  return (x: number, y: number): number => {
    const fx = x / cell;
    const fy = y / cell;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = smooth(fx - x0);
    const ty = smooth(fy - y0);
    const g = (gx: number, gy: number) => grid[gy * gw + gx];
    const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * tx;
    const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * tx;
    return a + (b - a) * ty;
  };
}

/** A lake with an island in the middle and a ring of mainland around the edges. */
export function generateTerrain(seed: number, w = MAP_SIZE, h = MAP_SIZE): Terrain[] {
  const rand = mulberry32(seed);
  const coarse = makeNoise(rand, w, h, 6);
  const fine = makeNoise(rand, w, h, 3);
  const edge = makeNoise(rand, w, h, 5);
  const forest = makeNoise(rand, w, h, 4);
  const rock = makeNoise(rand, w, h, 4);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const out: Terrain[] = new Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy) + (coarse(x, y) - 0.5) * 5 + (fine(x, y) - 0.5) * 2;
      const e = Math.min(x, y, w - 1 - x, h - 1 - y) + (edge(x, y) - 0.5) * 6;
      let t: Terrain;
      if (e < 4) {
        // Woods lean west, rocky hills lean east.
        const west = (cx - x) / w;
        if (forest(x, y) + west * 0.5 > 0.55) t = T.FOREST;
        else if (rock(x, y) - west * 0.5 > 0.55) t = T.ROCK;
        else t = T.MAINLAND;
      } else if (d < 8.5) t = T.ISLAND;
      else if (d < 11.5) t = T.MARSH;
      else if (d < 14 || e < 7) t = T.SHALLOW;
      else t = T.DEEP;
      out[y * w + x] = t;
    }
  }

  // Guarantee both resource types exist on every map.
  ensureSome(out, w, h, T.FOREST, 0, Math.floor(w / 3));
  ensureSome(out, w, h, T.ROCK, Math.floor((2 * w) / 3), w);
  return out;
}

function ensureSome(out: Terrain[], w: number, h: number, kind: Terrain, x0: number, x1: number) {
  const count = out.filter((t) => t === kind).length;
  if (count >= 12) return;
  let need = 12 - count;
  for (let y = 0; y < h && need > 0; y++) {
    for (let x = x0; x < x1 && need > 0; x++) {
      const i = y * w + x;
      if (out[i] === T.MAINLAND && (y + x) % 2 === 0) {
        out[i] = kind;
        need--;
      }
    }
  }
}
