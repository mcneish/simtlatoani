import { SAVE_VERSION, type GameState } from './sim/state';

const KEY = 'simtlatoani-partida';

export function saveGame(s: GameState) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s.version === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return loadGame() !== null;
}

export function deleteSave() {
  localStorage.removeItem(KEY);
}
