export const T = {
  DEEP: 0,
  SHALLOW: 1,
  MARSH: 2,
  ISLAND: 3,
  MAINLAND: 4,
  FOREST: 5,
  ROCK: 6,
} as const;

export type Terrain = (typeof T)[keyof typeof T];

export function isWater(t: Terrain): boolean {
  return t === T.DEEP || t === T.SHALLOW;
}

/** Land on the lake shore (not the island). */
export function isMainland(t: Terrain): boolean {
  return t === T.MAINLAND || t === T.FOREST || t === T.ROCK;
}

export function isLand(t: Terrain): boolean {
  return t === T.ISLAND || isMainland(t);
}
