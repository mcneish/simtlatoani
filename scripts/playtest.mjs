// Plays SimTlatoani through the real UI (mouse clicks on the palette and map)
// and saves screenshots to ./playtest. Usage: node scripts/playtest.mjs [url]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5199/';
const out = 'playtest';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const state = () => page.evaluate(() => {
  const s = window.game.state;
  return s && { day: s.day, pop: s.population, status: s.status, favor: s.favor, res: s.res, lost: s.lostReason };
});

await page.goto(url);
await page.waitForTimeout(500);
await shot('01-title');

await page.getByRole('button', { name: 'Cómo jugar' }).click();
await shot('02-help');
await page.getByRole('button', { name: 'Volver' }).click();
await page.getByRole('button', { name: 'Nueva partida' }).click();
await page.waitForTimeout(300);
await shot('03-new-game');

// Tooltip on hover
await page.hover('[data-tool="lenadores"]');
await shot('04-tooltip');

// Invalid placement: chinampa on the island center
await page.click('[data-tool="chinampa"]');
const center = await page.evaluate(() => window.game.tileToScreen(28, 28));
await page.mouse.click(center.x, center.y);
await page.waitForTimeout(200);
await shot('05-invalid-placement');
await page.keyboard.press('Escape');

/** Click a tile with the real mouse, scrolling the camera into view if needed. */
async function clickTile(x, y) {
  let p = await page.evaluate(([x, y]) => window.game.tileToScreen(x, y), [x, y]);
  if (p.x < 40 || p.x > 1240 || p.y < 90 || p.y > 600) {
    await page.evaluate(([x, y]) => {
      const g = window.game;
      g.camera.cx = (x + 0.5) * 24;
      g.camera.cy = (y + 0.5) * 24;
    }, [x, y]);
    p = await page.evaluate(([x, y]) => window.game.tileToScreen(x, y), [x, y]);
  }
  await page.mouse.click(p.x, p.y);
}

async function playUntil(predicate, maxSteps, shotEvery, prefix) {
  let shots = 0;
  for (let i = 0; i < maxSteps; i++) {
    const s = await state();
    if (predicate(s)) return s;
    const a = await page.evaluate(() => window.autoplayer.nextAction(window.game.state));
    if (a) {
      const active = await page.evaluate(() => window.game.tool);
      if (active !== a.id) await page.click(`[data-tool="${a.id}"]`);
      await clickTile(a.x, a.y);
    } else {
      await page.waitForTimeout(150);
    }
    if (i % shotEvery === 0) await shot(`${prefix}-${String(shots++).padStart(2, '0')}`);
  }
  return state();
}

await page.click('[data-speed="10"]');
let s = await playUntil((s) => s.day >= 120, 400, 60, '10-early');
console.log('day 120:', s);
await page.evaluate(() => window.game.centerCamera(window.game.state));
await shot('11-day120');

// Save, reload, continue
await page.keyboard.press('Escape'); // deselect tool
await page.keyboard.press('Escape'); // open menu
await shot('12-menu');
await page.getByRole('button', { name: 'Guardar partida' }).click();
const savedDay = (await state()).day;
await page.reload();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Continuar' }).click();
const resumed = await state();
console.log('saved day', savedDay, 'resumed day', resumed.day);
await page.click('[data-speed="10"]');

s = await playUntil((s) => s.status !== 'playing', 4000, 250, '20-mid');
console.log('end of run:', s);
await page.waitForTimeout(300);
await shot('30-end');

// Loss run: demolish the farms with the Demoler tool and let the city starve
await page.getByRole('button', { name: 'Nueva partida' }).click();
await page.click('[data-tool="demoler"]');
const farms = await page.evaluate(() => {
  const s = window.game.state;
  return s.buildings.flatMap((b, i) => (b === 'chinampa' ? [[i % s.width, Math.floor(i / s.width)]] : []));
});
for (const [x, y] of farms) await clickTile(x, y);
// Wrong-terrain message: a chinampa on dry island land
await page.click('[data-tool="chinampa"]');
const dry = await page.evaluate(() => {
  const s = window.game.state;
  const i = s.terrain.findIndex((t, i) => t === 3 && !s.buildings[i]);
  return [i % s.width, Math.floor(i / s.width)];
});
await clickTile(dry[0], dry[1]);
await page.waitForTimeout(200);
await shot('40-wrong-terrain');
await page.keyboard.press('Escape');
await page.evaluate(() => window.game.centerCamera(window.game.state));
await page.click('[data-speed="10"]');
for (let i = 0; i < 60; i++) {
  const st = await state();
  if (st.status !== 'playing') break;
  if (i === 4) await shot('41-famine');
  await page.waitForTimeout(1000);
}
console.log('starvation run:', await state());
await shot('42-lost');

console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
