// Records the SimTlatoani demo (?demo=1) with Playwright and encodes a sped-up MP4.
// The title and victory screens play at normal speed; gameplay is compressed so the
// whole video fits in MAX_SECONDS. Usage: npm run demo  (builds first)
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const MAX_SECONDS = 44.5; // hard limit is 45 s
const PORT = 5198;
const SEED = process.env.DEMO_SEED ?? '7';
const OUT = 'demo/simtlatoani-demo.mp4';

rmSync('demo/raw', { recursive: true, force: true });
mkdirSync('demo/raw', { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve());
  server.on('exit', (code) => reject(new Error(`preview server exited (${code})`)));
});

let rawPath;
let marks;
let videoStart;
try {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: 'demo/raw', size: { width: 1280, height: 720 } },
  });
  videoStart = Date.now();
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('page error:', e));
  await page.goto(`http://localhost:${PORT}/?demo=1&seed=${SEED}`);
  await page.waitForFunction(() => window.demoDone === true, null, { timeout: 15 * 60_000, polling: 1000 });
  marks = await page.evaluate(() => window.demoMarks);
  const s = await page.evaluate(() => ({ day: window.game.state.day, pop: window.game.state.population, status: window.game.state.status }));
  console.log('demo finished:', s);
  await context.close();
  rawPath = await page.video().path();
  await browser.close();
} finally {
  server.kill();
}

const duration = Number(
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', rawPath]).toString(),
);
const rel = (k) => (marks[k] - videoStart) / 1000;
const t0 = Math.max(0, rel('start') + 0.2); // skip the blank page before load
const t1 = rel('playStart');
const t2 = rel('playEnd');
const t3 = Math.min(duration, rel('end'));
const fixed = t1 - t0 + (t3 - t2);
const factor = Math.max(1, (t2 - t1) / (MAX_SECONDS - fixed));
console.log({ duration, t0, t1, t2, t3, factor: factor.toFixed(2) });

const filter = [
  `[0:v]trim=${t0}:${t1},setpts=PTS-STARTPTS[a]`,
  `[0:v]trim=${t1}:${t2},setpts=(PTS-STARTPTS)/${factor}[b]`,
  `[0:v]trim=${t2}:${t3},setpts=PTS-STARTPTS[c]`,
  `[a][b][c]concat=n=3:v=1:a=0,fps=30,format=yuv420p[out]`,
].join(';');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', rawPath, '-filter_complex', filter, '-map', '[out]',
  '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', OUT], { stdio: 'inherit' });

const final = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUT]).toString());
console.log(`wrote ${OUT}: ${final.toFixed(1)} s`);
if (final > 45) {
  console.error('demo is longer than 45 s');
  process.exit(1);
}
