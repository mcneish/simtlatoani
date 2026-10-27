import { describe, expect, it } from 'vitest';
import { canPlace, countBuildings, demolish, isConnected, place } from '../src/sim/buildings';
import { emptyState, newGame } from '../src/sim/state';
import { T } from '../src/sim/terrain';

function rich(fill: number) {
  const s = emptyState(8, 8, fill as never);
  s.res = { maiz: 999, madera: 999, piedra: 999, cacao: 999 };
  return s;
}

describe('placement rules', () => {
  it('allows chinampas on marsh and shallow water only', () => {
    const s = rich(T.MARSH);
    s.terrain[1] = T.SHALLOW;
    s.terrain[2] = T.ISLAND;
    s.terrain[3] = T.DEEP;
    expect(canPlace(s, 0, 0, 'chinampa').ok).toBe(true);
    expect(canPlace(s, 1, 0, 'chinampa').ok).toBe(true);
    expect(canPlace(s, 2, 0, 'chinampa')).toEqual({ ok: false, reason: 'terrain' });
    expect(canPlace(s, 3, 0, 'chinampa')).toEqual({ ok: false, reason: 'terrain' });
  });

  it('puts lumber camps on forest and quarries on rock', () => {
    const s = rich(T.MAINLAND);
    s.terrain[0] = T.FOREST;
    s.terrain[1] = T.ROCK;
    expect(canPlace(s, 0, 0, 'lenadores').ok).toBe(true);
    expect(canPlace(s, 1, 0, 'lenadores').ok).toBe(false);
    expect(canPlace(s, 1, 0, 'cantera').ok).toBe(true);
    expect(canPlace(s, 2, 0, 'cantera').ok).toBe(false);
  });

  it('rejects occupied tiles and out-of-bounds', () => {
    const s = rich(T.ISLAND);
    expect(place(s, 0, 0, 'calli').ok).toBe(true);
    expect(canPlace(s, 0, 0, 'calli')).toEqual({ ok: false, reason: 'occupied' });
    expect(canPlace(s, -1, 0, 'calli')).toEqual({ ok: false, reason: 'bounds' });
  });

  it('charges the cost and reports what is missing', () => {
    const s = emptyState(4, 4, T.ISLAND);
    s.res.madera = 14;
    expect(place(s, 0, 0, 'calli').ok).toBe(true);
    expect(s.res.madera).toBe(2);
    expect(place(s, 1, 0, 'calli')).toEqual({ ok: false, reason: 'funds', missing: { madera: 10 } });
    expect(place(s, 2, 0, 'teocalli')).toEqual({ ok: false, reason: 'funds', missing: { piedra: 40, cacao: 25 } });
  });

  it('demolishes buildings', () => {
    const s = rich(T.ISLAND);
    place(s, 1, 1, 'tianguis');
    expect(demolish(s, 1, 1)).toBe(true);
    expect(demolish(s, 1, 1)).toBe(false);
    expect(countBuildings(s).tianguis).toBe(0);
  });
});

describe('causeway connection', () => {
  it('links the island to the mainland only through a full calzada', () => {
    // Row: mainland, water, water, island
    const s = rich(T.DEEP);
    s.terrain[0] = T.MAINLAND;
    s.terrain[3] = T.ISLAND;
    expect(isConnected(s)).toBe(false);
    place(s, 2, 0, 'calzada');
    expect(isConnected(s)).toBe(false);
    place(s, 1, 0, 'calzada');
    expect(isConnected(s)).toBe(true);
  });
});

describe('new game', () => {
  it('generates a lake with an island, marsh, forest and rocks', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const s = newGame(seed);
      const count = (k: number) => s.terrain.filter((t) => t === k).length;
      expect(count(T.ISLAND)).toBeGreaterThan(150);
      expect(count(T.MARSH)).toBeGreaterThan(80);
      expect(count(T.FOREST)).toBeGreaterThanOrEqual(12);
      expect(count(T.ROCK)).toBeGreaterThanOrEqual(12);
      const c = countBuildings(s);
      expect(c).toMatchObject({ teocalli: 1, calli: 2, chinampa: 2 });
      expect(isConnected(s)).toBe(false);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(newGame(7).terrain).toEqual(newGame(7).terrain);
  });
});
