import type { BuildingId } from './buildings';
import { generateTerrain, MAP_SIZE } from './map';
import { T, type Terrain } from './terrain';

export type ResourceId = 'maiz' | 'madera' | 'piedra' | 'cacao';
export type Resources = Record<ResourceId, number>;
export const RESOURCE_IDS: ResourceId[] = ['maiz', 'madera', 'piedra', 'cacao'];

export type LogKind = 'good' | 'bad' | 'info';
export interface LogEntry {
  day: number;
  text: string;
  kind: LogKind;
}

export type Status = 'playing' | 'won' | 'lost';

export interface Delta extends Resources {
  favor: number;
  population: number;
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  width: number;
  height: number;
  terrain: Terrain[];
  buildings: (BuildingId | null)[];
  day: number;
  res: Resources;
  population: number;
  favor: number;
  droughtDays: number;
  famine: boolean;
  lowFavorWarned: boolean;
  milestone: number;
  status: Status;
  lostReason: 'favor' | 'population' | null;
  victoryShown: boolean;
  log: LogEntry[];
  /** Total log entries ever written; lets the UI detect new ones. */
  logCount: number;
  delta: Delta;
}

export const SAVE_VERSION = 1;
export const GOAL_POPULATION = 2500;
export const MILESTONES = [500, 1000, 1500, 2000];

export function emptyDelta(): Delta {
  return { maiz: 0, madera: 0, piedra: 0, cacao: 0, favor: 0, population: 0 };
}

export function emptyState(width: number, height: number, fill: Terrain, seed = 1): GameState {
  return {
    version: SAVE_VERSION,
    seed,
    rng: seed,
    width,
    height,
    terrain: new Array(width * height).fill(fill),
    buildings: new Array(width * height).fill(null),
    day: 0,
    res: { maiz: 0, madera: 0, piedra: 0, cacao: 0 },
    population: 0,
    favor: 60,
    droughtDays: 0,
    famine: false,
    lowFavorWarned: false,
    milestone: 0,
    status: 'playing',
    lostReason: null,
    victoryShown: false,
    log: [],
    logCount: 0,
    delta: emptyDelta(),
  };
}

export function newGame(seed: number): GameState {
  const s = emptyState(MAP_SIZE, MAP_SIZE, T.DEEP, seed);
  s.terrain = generateTerrain(seed);
  s.res = { maiz: 120, madera: 80, piedra: 40, cacao: 10 };
  s.population = 40;
  s.favor = 60;

  // Starter village: a temple flanked by two houses, plus two chinampas.
  const cx = Math.floor(s.width / 2);
  const cy = Math.floor(s.height / 2);
  const near = (kind: Terrain, n: number) => {
    const out: number[] = [];
    for (let i = 0; i < s.terrain.length; i++) if (s.terrain[i] === kind && !s.buildings[i]) out.push(i);
    const dist = (i: number) => Math.hypot((i % s.width) - cx, Math.floor(i / s.width) - cy);
    return out.sort((a, b) => dist(a) - dist(b)).slice(0, n);
  };
  const [temple, ...houses] = near(T.ISLAND, 3);
  s.buildings[temple] = 'teocalli';
  for (const i of houses) s.buildings[i] = 'calli';
  for (const i of near(T.MARSH, 2)) s.buildings[i] = 'chinampa';
  return s;
}

export function addLog(s: GameState, text: string, kind: LogKind) {
  s.log.push({ day: s.day, text, kind });
  if (s.log.length > 50) s.log.shift();
  s.logCount++;
}

export function idx(s: GameState, x: number, y: number): number {
  return y * s.width + x;
}

export function inBounds(s: GameState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < s.width && y < s.height;
}
