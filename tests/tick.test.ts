import { describe, expect, it } from 'vitest';
import { place } from '../src/sim/buildings';
import { flood } from '../src/sim/events';
import { emptyState, GOAL_POPULATION, type GameState } from '../src/sim/state';
import { T } from '../src/sim/terrain';
import { BALANCE, step } from '../src/sim/tick';

/** 10x10 marsh with an island strip on row 0 and mainland at the far right column. */
function world(): GameState {
  const s = emptyState(10, 10, T.MARSH);
  for (let x = 0; x < 10; x++) s.terrain[x] = T.ISLAND;
  for (let y = 0; y < 10; y++) s.terrain[y * 10 + 9] = T.FOREST;
  s.res = { maiz: 0, madera: 999, piedra: 999, cacao: 999 };
  s.favor = 60;
  return s;
}

describe('daily step', () => {
  it('chinampas produce maize that people eat', () => {
    const s = world();
    place(s, 0, 1, 'chinampa');
    place(s, 0, 0, 'calli');
    s.population = 10;
    s.res.maiz = 50;
    step(s);
    // 3 produced (fully staffed), 1 eaten
    expect(s.res.maiz).toBeCloseTo(50 + BALANCE.chinampaMaiz - 10 * BALANCE.eatPerPerson);
  });

  it('understaffed buildings produce proportionally less', () => {
    const s = world();
    place(s, 0, 1, 'chinampa');
    place(s, 1, 1, 'chinampa');
    place(s, 0, 0, 'calli');
    s.population = 4; // 8 jobs
    s.res.maiz = 50;
    step(s);
    expect(s.res.maiz).toBeCloseTo(50 + 2 * BALANCE.chinampaMaiz * 0.5 - 4 * BALANCE.eatPerPerson);
  });

  it('population grows toward housing when fed', () => {
    const s = world();
    place(s, 0, 0, 'calli');
    s.population = 5;
    s.res.maiz = 10000;
    for (let i = 0; i < 100; i++) step(s);
    expect(s.population).toBe(25);
  });

  it('famine shrinks the population and logs it', () => {
    const s = world();
    place(s, 0, 0, 'calli');
    s.population = 25;
    s.res.maiz = 0;
    step(s);
    expect(s.population).toBe(24);
    expect(s.famine).toBe(true);
    expect(s.log.at(-1)?.text).toMatch(/Hambruna/);
  });

  it('homeless people leave when houses are lost', () => {
    const s = world();
    s.population = 50;
    s.res.maiz = 100;
    place(s, 0, 0, 'calli');
    step(s);
    expect(s.population).toBeLessThan(50);
    expect(s.population).toBeGreaterThan(25);
  });

  it('mainland camps produce only when connected by calzada', () => {
    const s = world();
    // Make row 1 deep water so the only link is a causeway at (8,1).
    for (let x = 0; x < 9; x++) s.terrain[10 + x] = T.DEEP;
    for (let x = 0; x < 9; x++) s.terrain[x] = T.ISLAND;
    s.terrain[9] = T.DEEP;
    s.terrain[8] = T.DEEP;
    place(s, 0, 0, 'calli');
    place(s, 9, 1, 'lenadores');
    s.population = 20;
    s.res.maiz = 100;
    const start = s.res.madera;
    step(s);
    expect(s.res.madera).toBe(start);
    place(s, 8, 0, 'calzada'); // island(7,0) -> calzada(8,0) -> calzada(9,0) -> forest(9,1)
    step(s);
    expect(s.res.madera).toBe(start);
    place(s, 9, 0, 'calzada');
    step(s);
    expect(s.res.madera).toBeCloseTo(start + BALANCE.lenadoresMadera);
  });

  it('the tianguis turns spare maize into cacao but keeps a reserve', () => {
    const s = world();
    place(s, 0, 0, 'tianguis');
    place(s, 1, 0, 'calli');
    s.population = 4;
    s.res.cacao = 0;
    s.res.maiz = 102;
    step(s);
    // 102 - 0.4 eaten, market may use only what is above 100
    expect(s.res.cacao).toBeCloseTo(1);
    expect(s.res.maiz).toBeCloseTo(100 - 0.4);
  });

  it('favor decays without temples and rises with them', () => {
    const s = world();
    place(s, 0, 0, 'calli');
    s.population = 20;
    s.res.maiz = 100;
    step(s);
    expect(s.favor).toBeLessThan(60);
    place(s, 1, 0, 'teocalli');
    const f = s.favor;
    step(s);
    expect(s.favor).toBeGreaterThan(f);
  });

  it('tribute arrives every 90 days', () => {
    const s = world();
    place(s, 0, 0, 'calli');
    place(s, 1, 0, 'teocalli');
    s.population = 20;
    s.res.maiz = 1000;
    s.day = 89;
    const cacao = s.res.cacao;
    step(s);
    expect(s.res.cacao).toBeGreaterThan(cacao);
    expect(s.log.some((l) => l.text.includes('tributo'))).toBe(true);
  });

  it('a full albarradón blocks floods', () => {
    const s = world();
    for (let x = 0; x < 9; x++) s.terrain[50 + x] = T.SHALLOW;
    for (let x = 0; x < 9; x++) s.terrain[60 + x] = T.SHALLOW;
    for (let x = 0; x < 6; x++) place(s, x, 2, 'chinampa');
    flood(s, { calli: 0, chinampa: 6, calzada: 0, lenadores: 0, cantera: 0, tianguis: 0, teocalli: 0, albarradon: 12 });
    expect(s.buildings.filter((b) => b === 'chinampa').length).toBe(6);
    expect(s.log.at(-1)?.kind).toBe('good');
  });

  it('ends the game on zero population, zero favor, or reaching the goal', () => {
    const a = world();
    a.population = 1;
    a.res.maiz = 0;
    step(a);
    expect(a.status).toBe('lost');
    expect(a.lostReason).toBe('population');

    const b = world();
    place(b, 0, 0, 'calli');
    b.population = 10;
    b.res.maiz = 100;
    b.favor = 0.01;
    step(b);
    expect(b.status).toBe('lost');
    expect(b.lostReason).toBe('favor');

    const c = world();
    c.buildings.fill('calli');
    c.population = GOAL_POPULATION;
    c.res.maiz = 99999;
    step(c);
    expect(c.status).toBe('won');
  });
});
