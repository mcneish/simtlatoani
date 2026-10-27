import { DIKE_SEGMENTS, type BuildingId } from './buildings';
import { t } from '../i18n/es-MX';
import { rand } from './rng';
import { addLog, type GameState } from './state';

export const TRIBUTE_EVERY = 90;
export const FLOOD_CHANCE = 0.004;
export const DROUGHT_CHANCE = 0.003;
export const OMEN_CHANCE = 0.012;

export function tribute(s: GameState) {
  const m = 20 + Math.floor(s.population / 40);
  const p = 15 + Math.floor(s.population / 60);
  const c = 10 + Math.floor(s.population / 80);
  s.res.madera += m;
  s.res.piedra += p;
  s.res.cacao += c;
  addLog(s, t.events.tribute(m, p, c), 'good');
}

export function flood(s: GameState, counts: Record<BuildingId, number>) {
  const protection = Math.min(1, counts.albarradon / DIKE_SEGMENTS);
  if (protection >= 1) {
    addLog(s, t.events.floodBlocked, 'good');
    return;
  }
  const exposure = 1 - protection;
  let lost = 0;
  for (let i = 0; i < s.buildings.length; i++) {
    const b = s.buildings[i];
    const chance = b === 'chinampa' ? 0.3 * exposure : b === 'calli' && s.terrain[i] === 2 ? 0.15 * exposure : 0;
    if (chance > 0 && rand(s) < chance) {
      s.buildings[i] = null;
      lost++;
    }
  }
  addLog(s, lost ? t.events.flood(lost) : t.events.floodNoDamage, lost ? 'bad' : 'info');
}

export function rollEvents(s: GameState, counts: Record<BuildingId, number>) {
  if (s.day % TRIBUTE_EVERY === 0) tribute(s);

  if (s.droughtDays === 0) {
    if (s.day > 120 && rand(s) < FLOOD_CHANCE) flood(s, counts);
    else if (s.day > 150 && rand(s) < DROUGHT_CHANCE) {
      s.droughtDays = 30;
      addLog(s, t.events.drought, 'bad');
    }
  }

  if (s.day > 20 && rand(s) < OMEN_CHANCE) {
    const goodChance = 0.15 + (s.favor / 100) * 0.7;
    const roll = rand(s);
    if (rand(s) < goodChance) {
      if (roll < 0.5) {
        s.favor += 6;
        addLog(s, t.events.omenEagle, 'good');
      } else {
        const n = 30 + Math.floor(s.population / 20);
        s.res.maiz += n;
        addLog(s, t.events.omenHarvest(n), 'good');
      }
    } else {
      s.favor -= 6;
      addLog(s, roll < 0.5 ? t.events.omenComet : t.events.omenLake, 'bad');
    }
  }
}
