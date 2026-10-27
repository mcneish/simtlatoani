import { BUILDINGS, canPlace, countBuildings, housing, isConnected, type BuildingId } from './buildings';
import { idx, inBounds, type GameState } from './state';
import { isMainland, T } from './terrain';
import { staffing } from './tick';

export interface Action {
  id: BuildingId;
  x: number;
  y: number;
}

/**
 * A simple greedy player: picks the next building a sensible tlatoani would place.
 * Used by the balance test and to drive the demo video through the real UI.
 */
export function nextAction(s: GameState): Action | null {
  const c = countBuildings(s);
  const connected = isConnected(s);
  const pop = s.population;
  const cap = housing(c);
  const staffed = staffing(s);
  const affordable = (id: BuildingId) =>
    Object.entries(BUILDINGS[id].cost).every(([r, n]) => s.res[r as keyof typeof s.res] >= (n as number));

  if (!connected) {
    const path = causewayPath(s);
    const next = path.find((i) => !s.buildings[i]);
    if (next !== undefined && affordable('calzada')) return at(s, 'calzada', next);
    if (next !== undefined) return null;
  }

  const foodNet = s.delta.maiz;
  const hungry = s.res.maiz < 60 || (foodNet < pop * 0.02 && s.res.maiz < pop * 2);
  if (hungry && staffed > 0.85) {
    const a = tryBuild(s, 'chinampa', centerDist(s));
    if (a) return a;
  }
  if (connected && c.lenadores < 2 + Math.floor(pop / 400) && staffed > 0.8) {
    const a = tryBuild(s, 'lenadores', shoreDist(s));
    if (a) return a;
  }
  if (connected && c.cantera < 1 + Math.floor(pop / 700) && staffed > 0.8) {
    const a = tryBuild(s, 'cantera', shoreDist(s));
    if (a) return a;
  }
  const favorDecay = 0.05 + pop / 1500;
  if (c.teocalli * 0.25 < favorDecay + 0.1 || s.favor < 40) {
    const a = tryBuild(s, 'teocalli', centerDist(s));
    if (a) return a;
    if (c.tianguis < 1 + Math.floor(pop / 900)) {
      const m = tryBuild(s, 'tianguis', centerDist(s));
      if (m) return m;
    }
  }
  if (c.tianguis < Math.floor(pop / 900)) {
    const a = tryBuild(s, 'tianguis', centerDist(s));
    if (a) return a;
  }
  if (pop >= cap * 0.8 - 10 && !s.famine && staffed > 0.6) {
    const a = tryBuild(s, 'calli', centerDist(s), [T.ISLAND]) ?? tryBuild(s, 'calli', centerDist(s));
    if (a) return a;
  }
  if (pop > 600 && c.albarradon < 12 && s.res.piedra > 80) {
    const a = tryBuild(s, 'albarradon', dikeLine(s));
    if (a) return a;
  }
  return null;
}

function at(s: GameState, id: BuildingId, i: number): Action {
  return { id, x: i % s.width, y: Math.floor(i / s.width) };
}

function tryBuild(s: GameState, id: BuildingId, score: (i: number) => number, only?: number[]): Action | null {
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < s.terrain.length; i++) {
    if (only && !only.includes(s.terrain[i])) continue;
    const x = i % s.width;
    const y = Math.floor(i / s.width);
    if (!canPlace(s, x, y, id).ok) continue;
    const sc = score(i);
    if (sc < bestScore) {
      bestScore = sc;
      best = i;
    }
  }
  return best >= 0 ? at(s, id, best) : null;
}

function centerDist(s: GameState) {
  const cx = s.width / 2;
  const cy = s.height / 2;
  return (i: number) => Math.hypot((i % s.width) - cx, Math.floor(i / s.width) - cy) + ((i * 7919) % 13) / 100;
}

/** A straight north–south dike east of the city, like the Albarradón de Nezahualcóyotl. */
function dikeLine(s: GameState) {
  const x0 = Math.floor(s.width / 2) + 14;
  const cy = s.height / 2;
  return (i: number) => Math.abs((i % s.width) - x0) * 100 + Math.abs(Math.floor(i / s.width) - cy);
}

/** Prefer mainland spots close to where the causeway lands. */
function shoreDist(s: GameState) {
  const path = causewayPath(s);
  const end = path.length ? path[path.length - 1] : idx(s, 0, 0);
  const ex = end % s.width;
  const ey = Math.floor(end / s.width);
  return (i: number) => Math.hypot((i % s.width) - ex, Math.floor(i / s.width) - ey);
}

/** Shortest water/marsh path (tile indices, island side first) from the island to the mainland. */
export function causewayPath(s: GameState): number[] {
  const prev = new Int32Array(s.width * s.height).fill(-2);
  const queue: number[] = [];
  for (let i = 0; i < s.terrain.length; i++) {
    if (s.terrain[i] === T.ISLAND) {
      prev[i] = -1;
      queue.push(i);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % s.width;
    const y = Math.floor(i / s.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(s, nx, ny)) continue;
      const n = idx(s, nx, ny);
      if (prev[n] !== -2) continue;
      if (isMainland(s.terrain[n])) {
        const path: number[] = [];
        for (let p = i; p >= 0 && s.terrain[p] !== T.ISLAND; p = prev[p]) path.push(p);
        return path.reverse();
      }
      const b = s.buildings[n];
      if (b && b !== 'calzada') continue;
      if (!BUILDINGS.calzada.allowed.includes(s.terrain[n])) continue;
      prev[n] = i;
      queue.push(n);
    }
  }
  return [];
}
