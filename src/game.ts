import { canPlace, countBuildings, demolish, housing, isConnected, place, totalJobs } from './sim/buildings';
import { newGame, type GameState } from './sim/state';
import { step, workforce } from './sim/tick';
import { t } from './i18n/es-MX';
import { attachInput } from './input';
import { Renderer, TILE, type Camera, type Hover } from './render/renderer';
import { hasSave, loadGame, saveGame } from './save';
import { UI, type Tool } from './ui';

/** Real milliseconds per in-game day at 1× speed. */
export const DAY_MS = 1000;
const AUTOSAVE_DAYS = 30;

export class Game {
  state: GameState | null = null;
  speed = 1;
  tool: Tool | null = null;
  hoverTile: { x: number; y: number } | null = null;
  camera: Camera = { cx: 0, cy: 0, zoom: 1.5 };
  readonly renderer: Renderer;
  readonly ui: UI;
  private input: ReturnType<typeof attachInput>;
  private titleState = newGame(20260);
  private prevSpeed = 1;
  private acc = 0;
  private last = 0;
  private uiTimer = 0;
  private seenLog = 0;
  private fundsWarned = false;

  constructor(canvas: HTMLCanvasElement, root: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.ui = new UI(root, {
      newGame: () => this.newGame(),
      continueGame: () => this.continueGame(),
      save: () => this.save(),
      quitToTitle: () => this.quitToTitle(),
      resume: () => this.ui.closeModal(),
      keepPlaying: () => this.keepPlaying(),
      selectTool: (tool) => this.selectTool(tool),
      setSpeed: (n) => this.setSpeed(n),
    });
    this.input = attachInput(this, canvas);
  }

  start() {
    this.centerCamera(this.titleState);
    this.ui.showTitle(hasSave());
    requestAnimationFrame(this.loop);
  }

  newGame(seed = Number(new URLSearchParams(location.search).get('seed')) || Math.floor(Math.random() * 1e9)) {
    this.load(newGame(seed));
    this.ui.toast(t.welcome, 'info');
  }

  continueGame() {
    const s = loadGame();
    if (s) this.load(s);
  }

  private load(s: GameState) {
    this.state = s;
    this.seenLog = s.logCount;
    this.tool = null;
    this.speed = 1;
    this.acc = 0;
    this.centerCamera(s);
    this.ui.closeModal();
    this.ui.setPlaying(true);
    this.refreshHud();
  }

  quitToTitle() {
    this.state = null;
    this.tool = null;
    this.ui.setPlaying(false);
    this.centerCamera(this.titleState);
    this.ui.showTitle(hasSave());
  }

  keepPlaying() {
    if (!this.state) return;
    this.state.victoryShown = true;
    this.state.status = 'playing';
    this.ui.closeModal();
  }

  save() {
    if (!this.state) return;
    saveGame(this.state);
    this.ui.toast(t.saved, 'good');
  }

  selectTool(tool: Tool | null) {
    this.tool = tool && this.tool === tool ? null : tool;
    this.refreshHud();
  }

  setSpeed(n: number) {
    if (n === 0 && this.speed !== 0) this.prevSpeed = this.speed;
    this.speed = n;
    this.refreshHud();
  }

  togglePause() {
    this.setSpeed(this.speed === 0 ? this.prevSpeed || 1 : 0);
  }

  escape() {
    if (!this.state) return;
    if (this.ui.modalKind === 'menu' || this.ui.modalKind === 'help') this.ui.closeModal();
    else if (this.ui.modalOpen) return;
    else if (this.tool) this.selectTool(null);
    else this.ui.showMenu();
  }

  /** Called at the start of each mouse stroke so drag-building warns about funds at most once. */
  beginStroke() {
    this.fundsWarned = false;
  }

  tryPlace(x: number, y: number, quiet: boolean) {
    const s = this.state;
    if (!s || !this.tool || s.status !== 'playing') return;
    if (this.tool === 'demoler') return this.demolishAt(x, y, quiet);
    const r = place(s, x, y, this.tool);
    if (r.ok) {
      this.refreshHud();
      return;
    }
    if (r.reason === 'funds') {
      if (!this.fundsWarned) this.ui.toast(t.errors.funds(r.missing), 'bad');
      this.fundsWarned = true;
    } else if (!quiet) {
      this.ui.toast(r.reason === 'terrain' ? t.buildings[this.tool].rule : t.errors[r.reason], 'bad');
    }
  }

  demolishAt(x: number, y: number, quiet: boolean) {
    const s = this.state;
    if (!s || s.status !== 'playing') return;
    if (demolish(s, x, y)) this.refreshHud();
    else if (!quiet) this.ui.toast(t.errors.nothing, 'info');
  }

  screenToTile(sx: number, sy: number) {
    const w = this.renderer.screenToWorld(sx, sy, this.camera);
    return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
  }

  /** Screen position of a tile's center (used by the demo cursor). */
  tileToScreen(x: number, y: number) {
    const c = this.camera;
    return {
      x: ((x + 0.5) * TILE - c.cx) * c.zoom + this.renderer.width / 2,
      y: ((y + 0.5) * TILE - c.cy) * c.zoom + this.renderer.height / 2,
    };
  }

  panBy(dx: number, dy: number) {
    this.camera.cx += dx / this.camera.zoom;
    this.camera.cy += dy / this.camera.zoom;
    this.clampCamera();
  }

  zoomAt(sx: number, sy: number, factor: number) {
    const before = this.renderer.screenToWorld(sx, sy, this.camera);
    this.camera.zoom = Math.max(0.6, Math.min(3, this.camera.zoom * factor));
    const after = this.renderer.screenToWorld(sx, sy, this.camera);
    this.camera.cx += before.x - after.x;
    this.camera.cy += before.y - after.y;
    this.clampCamera();
  }

  centerCamera(s: GameState) {
    this.camera.cx = (s.width * TILE) / 2;
    this.camera.cy = (s.height * TILE) / 2;
    const fit = Math.min(this.renderer.width, this.renderer.height - 190) / (TILE * 21);
    this.camera.zoom = Math.max(0.9, Math.min(2.6, fit));
  }

  private clampCamera() {
    const s = this.state ?? this.titleState;
    this.camera.cx = Math.max(0, Math.min(s.width * TILE, this.camera.cx));
    this.camera.cy = Math.max(0, Math.min(s.height * TILE, this.camera.cy));
  }

  private loop = (now: number) => {
    const dt = Math.min(100, now - (this.last || now));
    this.last = now;
    this.input.update(dt);
    const s = this.state;

    if (s && s.status === 'playing' && this.speed > 0 && !this.ui.modalOpen) {
      this.acc += dt * this.speed;
      let n = 0;
      while (this.acc >= DAY_MS && n < 30 && s.status === 'playing') {
        this.acc -= DAY_MS;
        this.tick(s);
        n++;
      }
      if (n === 30) this.acc = 0;
    }

    if (!s) {
      // Slow drift over the lake behind the title screen.
      this.camera.cx = (this.titleState.width * TILE) / 2 + Math.sin(now / 9000) * 120;
      this.camera.cy = (this.titleState.height * TILE) / 2 + Math.cos(now / 11000) * 80;
    }

    this.renderer.render(s ?? this.titleState, this.camera, s ? this.hover(s) : null, now, !!this.tool);

    this.uiTimer += dt;
    if (s && this.uiTimer > 120) {
      this.uiTimer = 0;
      this.refreshHud();
    }
    requestAnimationFrame(this.loop);
  };

  private hover(s: GameState): Hover | null {
    const h = this.hoverTile;
    if (!h) return null;
    let ok = true;
    if (this.tool === 'demoler') ok = !!s.buildings[h.y * s.width + h.x];
    else if (this.tool) {
      const r = canPlace(s, h.x, h.y, this.tool);
      ok = r.ok;
    }
    const i = h.y * s.width + h.x;
    if (h.x >= 0 && h.y >= 0 && h.x < s.width && h.y < s.height) {
      const b = s.buildings[i];
      this.ui.setTileInfo(t.terrain[s.terrain[i]] + (b ? ` · ${t.buildings[b].name}` : ''));
    }
    return { x: h.x, y: h.y, tool: this.tool, ok };
  }

  private tick(s: GameState) {
    step(s);
    this.flushLog(s);
    if (s.status === 'playing' && s.day % AUTOSAVE_DAYS === 0) saveGame(s);
    if (s.status !== 'playing') {
      this.tool = null;
      this.refreshHud();
      this.ui.showEnd(s, countBuildings(s));
    }
  }

  private flushLog(s: GameState) {
    const fresh = Math.min(s.logCount - this.seenLog, s.log.length);
    for (const entry of s.log.slice(s.log.length - fresh)) this.ui.toast(entry.text, entry.kind);
    this.seenLog = s.logCount;
  }

  refreshHud() {
    const s = this.state;
    if (!s) return;
    const counts = countBuildings(s);
    const connected = isConnected(s);
    const jobs = totalJobs(counts, connected);
    this.ui.update(s, {
      speed: this.speed,
      tool: this.tool,
      connected,
      staffing: jobs > 0 ? Math.min(1, workforce(s.population) / jobs) : 1,
      workforce: workforce(s.population),
      housing: housing(counts),
      jobs,
      counts,
    });
  }
}
