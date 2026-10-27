import type { Game } from './game';
import { TILE } from './render/renderer';
import { nextAction } from './sim/autoplayer';

/**
 * Demo mode (?demo=1): plays the real game by moving a visible cursor and
 * dispatching real clicks to the UI and the map. The autoplayer only decides
 * what to build next; everything goes through the same handlers a player uses.
 */
export async function runDemo(game: Game) {
  const marks: Record<string, number> = {};
  const mark = (name: string) => (marks[name] = performance.timeOrigin + performance.now());
  Object.assign(window, { demoMarks: marks });

  const cursor = document.createElement('div');
  cursor.className = 'demo-cursor';
  cursor.innerHTML =
    '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M4 2 L4 22 L9 17 L13 26 L17 24 L13 15 L20 15 Z" fill="#fff" stroke="#1a120a" stroke-width="2" stroke-linejoin="round"/></svg>';
  document.body.append(cursor);
  const canvas = game.renderer.canvas;
  let px = innerWidth / 2;
  let py = innerHeight / 2;
  const place = () => (cursor.style.transform = `translate(${px - 4}px, ${py - 2}px)`);
  place();

  let framed = false;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const pointer = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, pointerId: 1 }));

  async function moveTo(x: number, y: number, ms: number, overMap: boolean) {
    const sx = px;
    const sy = py;
    const start = performance.now();
    for (;;) {
      const k = Math.min(1, (performance.now() - start) / ms);
      px = sx + (x - sx) * ease(k);
      py = sy + (y - sy) * ease(k);
      place();
      if (overMap) pointer('pointermove', px, py);
      if (k >= 1) break;
      await frame();
    }
  }

  function ripple() {
    const r = document.createElement('div');
    r.className = 'demo-ripple';
    r.style.left = `${px}px`;
    r.style.top = `${py}px`;
    document.body.append(r);
    setTimeout(() => r.remove(), 450);
  }

  async function clickEl(selector: string, ms = 260) {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`demo: missing ${selector}`);
    const r = el.getBoundingClientRect();
    await moveTo(r.left + r.width / 2, r.top + r.height / 2, ms, false);
    ripple();
    el.click();
  }

  async function hoverEl(selector: string, ms: number) {
    const el = document.querySelector<HTMLElement>(selector)!;
    const r = el.getBoundingClientRect();
    await moveTo(r.left + r.width / 2, r.top + r.height / 2, 400, false);
    el.dispatchEvent(new MouseEvent('mouseenter'));
    await sleep(ms);
    el.dispatchEvent(new MouseEvent('mouseleave'));
  }

  /** Smoothly pans the camera if a tile is outside the comfortable view area. */
  async function ensureVisible(x: number, y: number) {
    const p = game.tileToScreen(x, y);
    const margin = { l: 80, r: innerWidth - 400, t: 130, b: innerHeight - 150 };
    if (p.x > margin.l && p.x < margin.r && p.y > margin.t && p.y < margin.b) return;
    const c = game.camera;
    const sx = c.cx;
    const sy = c.cy;
    const tx = sx + (p.x - (margin.l + margin.r) / 2) / c.zoom;
    const ty = sy + (p.y - (margin.t + margin.b) / 2) / c.zoom;
    const start = performance.now();
    for (;;) {
      const k = Math.min(1, (performance.now() - start) / 500);
      c.cx = sx + (tx - sx) * ease(k);
      c.cy = sy + (ty - sy) * ease(k);
      if (k >= 1) break;
      await frame();
    }
  }

  async function frameCity() {
    const c = game.camera;
    const from = { ...c };
    const to = { cx: (s().width * TILE) / 2, cy: (s().height * TILE) / 2 + 40, zoom: Math.max(0.6, (innerHeight - 200) / (TILE * 26)) };
    const start = performance.now();
    for (;;) {
      const k = Math.min(1, (performance.now() - start) / 900);
      c.cx = from.cx + (to.cx - from.cx) * ease(k);
      c.cy = from.cy + (to.cy - from.cy) * ease(k);
      c.zoom = from.zoom + (to.zoom - from.zoom) * ease(k);
      if (k >= 1) break;
      await frame();
    }
  }

  async function clickTile(x: number, y: number) {
    if (!framed) await ensureVisible(x, y);
    const p = game.tileToScreen(x, y);
    await moveTo(p.x, p.y, 170, true);
    ripple();
    pointer('pointerdown', p.x, p.y);
    pointer('pointerup', p.x, p.y);
  }

  // Title screen, then start a new game.
  mark('start');
  await sleep(1800);
  await clickEl('[data-action="new-game"]', 700);
  await sleep(1200);
  await hoverEl('[data-tool="calzada"]', 1500);
  await clickEl('[data-speed="10"]');
  mark('playStart');

  const s = () => game.state!;
  while (s().status === 'playing') {
    if (!framed && s().population >= 1900) {
      // Near the goal: frame the whole city for the finale.
      framed = true;
      await frameCity();
    }
    const a = nextAction(s());
    if (!a) {
      await sleep(100);
      continue;
    }
    if (game.tool !== a.id) await clickEl(`[data-tool="${a.id}"]`, 220);
    await clickTile(a.x, a.y);
  }
  mark('playEnd');
  cursor.style.opacity = '0';
  await sleep(5000);
  mark('end');
  Object.assign(window, { demoDone: true });
}
