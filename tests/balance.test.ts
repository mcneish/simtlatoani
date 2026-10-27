import { describe, expect, it } from 'vitest';
import { nextAction } from '../src/sim/autoplayer';
import { countBuildings, place } from '../src/sim/buildings';
import { newGame } from '../src/sim/state';
import { step } from '../src/sim/tick';

function play(seed: number, maxDays = 2500, actionsPerDay = 3) {
  const s = newGame(seed);
  while (s.status === 'playing' && s.day < maxDays) {
    for (let k = 0; k < actionsPerDay; k++) {
      const a = nextAction(s);
      if (!a || !place(s, a.x, a.y, a.id).ok) break;
    }
    step(s);
  }
  return s;
}

describe('balance', () => {
  it('a sensible player can win in a reasonable number of days', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = play(seed);
      const c = countBuildings(s);
      console.log(`seed ${seed}: ${s.status} day ${s.day} pop ${s.population} favor ${s.favor.toFixed(0)}`, JSON.stringify(c));
      expect(s.status).toBe('won');
      expect(s.day).toBeGreaterThan(300);
      expect(s.day).toBeLessThan(1400);
    }
  });

  it('losing every farm starves the city', () => {
    const s = newGame(1);
    s.buildings = s.buildings.map((b) => (b === 'chinampa' ? null : b));
    while (s.status === 'playing' && s.day < 1000) step(s);
    expect(s.status).toBe('lost');
    expect(s.lostReason).toBe('population');
    expect(s.day).toBeLessThan(200);
  });

  it('neglecting the temples angers the gods', () => {
    const s = newGame(1);
    s.buildings = s.buildings.map((b) => (b === 'teocalli' ? null : b));
    while (s.status === 'playing' && s.day < 5000) {
      s.res.maiz = 1000; // keep everyone fed so only favor matters
      step(s);
    }
    expect(s.status).toBe('lost');
    expect(s.lostReason).toBe('favor');
  });
});
