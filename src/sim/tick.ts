import { countBuildings, housing, isConnected, totalJobs } from './buildings';
import { rollEvents } from './events';
import { t } from '../i18n/es-MX';
import { addLog, GOAL_POPULATION, MILESTONES, type GameState } from './state';

export const BALANCE = {
  chinampaMaiz: 3,
  lenadoresMadera: 2,
  canteraPiedra: 1.5,
  tianguisMaizIn: 4,
  tianguisCacaoOut: 2,
  tianguisReserve: 100,
  teocalliFavor: 0.25,
  favorDecayBase: 0.05,
  favorDecayPerPerson: 1 / 1500,
  eatPerPerson: 0.1,
  growthRate: 0.02,
  famineLoss: 0.04,
  homelessLoss: 0.1,
  droughtFactor: 0.5,
  lowFavor: 20,
};

const B = BALANCE;

export function favorGrowthFactor(favor: number): number {
  if (favor >= 50) return 1;
  if (favor >= 25) return 0.6;
  return 0.3;
}

/** Fraction of jobs that are filled (1 = fully staffed). */
export function staffing(s: GameState): number {
  const jobs = totalJobs(countBuildings(s), isConnected(s));
  return jobs > 0 ? Math.min(1, s.population / jobs) : 1;
}

/** Advances the simulation by one day. Mutates and returns the state. */
export function step(s: GameState): GameState {
  if (s.status !== 'playing') return s;
  s.day += 1;
  const counts = countBuildings(s);
  const connected = isConnected(s);
  const jobs = totalJobs(counts, connected);
  const ratio = jobs > 0 ? Math.min(1, s.population / jobs) : 1;
  const drought = s.droughtDays > 0;
  const before = { ...s.res, favor: s.favor, population: s.population };

  // Production
  s.res.maiz += counts.chinampa * B.chinampaMaiz * ratio * (drought ? B.droughtFactor : 1);
  if (connected) {
    s.res.madera += counts.lenadores * B.lenadoresMadera * ratio;
    s.res.piedra += counts.cantera * B.canteraPiedra * ratio;
  }
  if (counts.tianguis > 0) {
    const want = counts.tianguis * B.tianguisMaizIn * ratio;
    const used = Math.min(want, Math.max(0, s.res.maiz - B.tianguisReserve));
    s.res.maiz -= used;
    s.res.cacao += used * (B.tianguisCacaoOut / B.tianguisMaizIn);
  }

  // Food
  const need = s.population * B.eatPerPerson;
  if (s.res.maiz >= need) {
    s.res.maiz -= need;
    if (s.famine) {
      s.famine = false;
      addLog(s, t.events.famineEnd, 'info');
    }
  } else {
    s.res.maiz = 0;
    if (!s.famine) {
      s.famine = true;
      addLog(s, t.events.famine, 'bad');
    }
    s.population -= Math.max(1, Math.ceil(s.population * B.famineLoss));
  }

  // Population
  const cap = housing(counts);
  if (!s.famine && s.population < cap) {
    const growth = Math.max(1, Math.round((cap - s.population) * B.growthRate * favorGrowthFactor(s.favor)));
    s.population = Math.min(cap, s.population + growth);
  } else if (s.population > cap) {
    s.population -= Math.max(1, Math.ceil((s.population - cap) * B.homelessLoss));
  }
  s.population = Math.max(0, s.population);

  // Favor
  s.favor += counts.teocalli * B.teocalliFavor * ratio - (B.favorDecayBase + s.population * B.favorDecayPerPerson);
  if (drought) {
    s.droughtDays--;
    if (s.droughtDays === 0) addLog(s, t.events.droughtEnd, 'info');
  }

  s.delta = {
    maiz: s.res.maiz - before.maiz,
    madera: s.res.madera - before.madera,
    piedra: s.res.piedra - before.piedra,
    cacao: s.res.cacao - before.cacao,
    favor: s.favor - before.favor,
    population: s.population - before.population,
  };

  rollEvents(s, counts);
  s.favor = Math.max(0, Math.min(100, s.favor));

  if (s.favor < B.lowFavor && !s.lowFavorWarned) {
    s.lowFavorWarned = true;
    addLog(s, t.events.lowFavor, 'bad');
  } else if (s.favor >= B.lowFavor + 10) s.lowFavorWarned = false;

  for (const m of MILESTONES) {
    if (s.population >= m && s.milestone < m) {
      s.milestone = m;
      addLog(s, t.events.milestone(m), 'good');
    }
  }

  if (s.population <= 0) {
    s.status = 'lost';
    s.lostReason = 'population';
  } else if (s.favor <= 0) {
    s.status = 'lost';
    s.lostReason = 'favor';
  } else if (!s.victoryShown && s.population >= GOAL_POPULATION) {
    s.status = 'won';
  }
  return s;
}
