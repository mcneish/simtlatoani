import { idx, inBounds, type GameState, type ResourceId, type Resources } from './state';
import { isMainland, T, type Terrain } from './terrain';

export type BuildingId =
  | 'calli'
  | 'chinampa'
  | 'calzada'
  | 'lenadores'
  | 'cantera'
  | 'tianguis'
  | 'teocalli'
  | 'albarradon';

export interface BuildingDef {
  id: BuildingId;
  cost: Partial<Resources>;
  workers: number;
  housing: number;
  allowed: Terrain[];
}

const def = (id: BuildingId, cost: Partial<Resources>, workers: number, allowed: Terrain[], housing = 0): BuildingDef => ({
  id,
  cost,
  workers,
  housing,
  allowed,
});

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  calli: def('calli', { madera: 12 }, 0, [T.ISLAND, T.MARSH], 25),
  chinampa: def('chinampa', { madera: 6 }, 6, [T.MARSH, T.SHALLOW]),
  calzada: def('calzada', { piedra: 2 }, 0, [T.MARSH, T.SHALLOW, T.DEEP]),
  lenadores: def('lenadores', { madera: 10 }, 6, [T.FOREST]),
  cantera: def('cantera', { madera: 15 }, 8, [T.ROCK]),
  tianguis: def('tianguis', { madera: 20, piedra: 10 }, 4, [T.ISLAND]),
  teocalli: def('teocalli', { piedra: 40, cacao: 25 }, 5, [T.ISLAND]),
  albarradon: def('albarradon', { piedra: 4 }, 0, [T.SHALLOW, T.DEEP]),
};

export const BUILD_ORDER: BuildingId[] = [
  'calli',
  'chinampa',
  'calzada',
  'lenadores',
  'cantera',
  'tianguis',
  'teocalli',
  'albarradon',
];

/** Buildings on the mainland only produce if a causeway links them to the island. */
export const MAINLAND_BUILDINGS: BuildingId[] = ['lenadores', 'cantera'];

/** Albarradón segments needed for full flood protection. */
export const DIKE_SEGMENTS = 12;

export type PlaceResult =
  | { ok: true }
  | { ok: false; reason: 'bounds' | 'occupied' | 'terrain' }
  | { ok: false; reason: 'funds'; missing: Partial<Resources> };

export function missingFor(s: GameState, cost: Partial<Resources>): Partial<Resources> | null {
  const missing: Partial<Resources> = {};
  let any = false;
  for (const [r, n] of Object.entries(cost) as [ResourceId, number][]) {
    if (s.res[r] < n) {
      missing[r] = Math.ceil(n - s.res[r]);
      any = true;
    }
  }
  return any ? missing : null;
}

export function canPlace(s: GameState, x: number, y: number, id: BuildingId): PlaceResult {
  if (!inBounds(s, x, y)) return { ok: false, reason: 'bounds' };
  const i = idx(s, x, y);
  if (s.buildings[i]) return { ok: false, reason: 'occupied' };
  if (!BUILDINGS[id].allowed.includes(s.terrain[i])) return { ok: false, reason: 'terrain' };
  const missing = missingFor(s, BUILDINGS[id].cost);
  if (missing) return { ok: false, reason: 'funds', missing };
  return { ok: true };
}

export function place(s: GameState, x: number, y: number, id: BuildingId): PlaceResult {
  const r = canPlace(s, x, y, id);
  if (!r.ok) return r;
  for (const [res, n] of Object.entries(BUILDINGS[id].cost) as [ResourceId, number][]) s.res[res] -= n;
  s.buildings[idx(s, x, y)] = id;
  return r;
}

export function demolish(s: GameState, x: number, y: number): boolean {
  if (!inBounds(s, x, y)) return false;
  const i = idx(s, x, y);
  if (!s.buildings[i]) return false;
  s.buildings[i] = null;
  return true;
}

export function countBuildings(s: GameState): Record<BuildingId, number> {
  const c = Object.fromEntries(BUILD_ORDER.map((id) => [id, 0])) as Record<BuildingId, number>;
  for (const b of s.buildings) if (b) c[b]++;
  return c;
}

/** True if a chain of calzada tiles links the island to the mainland. */
export function isConnected(s: GameState): boolean {
  const seen = new Uint8Array(s.width * s.height);
  const queue: number[] = [];
  for (let i = 0; i < s.terrain.length; i++) {
    if (s.terrain[i] === T.ISLAND) {
      seen[i] = 1;
      queue.push(i);
    }
  }
  while (queue.length) {
    const i = queue.pop()!;
    const x = i % s.width;
    const y = Math.floor(i / s.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(s, nx, ny)) continue;
      const n = idx(s, nx, ny);
      if (seen[n]) continue;
      if (isMainland(s.terrain[n])) return true;
      if (s.buildings[n] === 'calzada') {
        seen[n] = 1;
        queue.push(n);
      }
    }
  }
  return false;
}

export function housing(counts: Record<BuildingId, number>): number {
  return counts.calli * BUILDINGS.calli.housing;
}

export function totalJobs(counts: Record<BuildingId, number>, connected: boolean): number {
  let jobs = 0;
  for (const id of BUILD_ORDER) {
    if (!connected && MAINLAND_BUILDINGS.includes(id)) continue;
    jobs += counts[id] * BUILDINGS[id].workers;
  }
  return jobs;
}
