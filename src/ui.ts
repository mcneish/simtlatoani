import { BUILD_ORDER, BUILDINGS, DIKE_SEGMENTS, missingFor, type BuildingId } from './sim/buildings';
import { GOAL_POPULATION, RESOURCE_IDS, type GameState, type LogKind, type ResourceId } from './sim/state';
import { fmt, t } from './i18n/es-MX';
import { drawBuilding, TERRAIN_COLORS } from './render/draw';
import { T } from './sim/terrain';

export type Tool = BuildingId | 'demoler';

export const RES_ICONS: Record<ResourceId, string> = { maiz: '🌽', madera: '🪵', piedra: '🪨', cacao: '🫘' };

export interface UICallbacks {
  newGame(): void;
  continueGame(): void;
  save(): void;
  quitToTitle(): void;
  resume(): void;
  keepPlaying(): void;
  selectTool(tool: Tool | null): void;
  setSpeed(speed: number): void;
}

export interface HudInfo {
  speed: number;
  tool: Tool | null;
  connected: boolean;
  staffing: number;
  housing: number;
  jobs: number;
  workforce: number;
  counts: Record<BuildingId, number>;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function costHtml(cost: Partial<Record<ResourceId, number>>): string {
  const parts = Object.entries(cost).map(([r, n]) => `<span>${RES_ICONS[r as ResourceId]}${n}</span>`);
  return parts.length ? parts.join(' ') : t.free;
}

const SPEEDS: [number, string, string][] = [
  [0, '⏸', t.speed.pause],
  [1, '1×', t.speed.x1],
  [3, '3×', t.speed.x3],
  [10, '10×', t.speed.x10],
];

export class UI {
  modalOpen = false;
  modalKind: 'title' | 'menu' | 'help' | 'end' | null = null;
  private hud = el('div', 'hud');
  private dateEl = el('div', 'date');
  private resEls = {} as Record<ResourceId, { value: HTMLElement; delta: HTMLElement }>;
  private popEl = el('span', 'value');
  private popDelta = el('span', 'delta');
  private workersEl = el('span', 'value');
  private favorFill = el('div', 'fill');
  private favorVal = el('span', 'value');
  private goalFill = el('div', 'fill');
  private goalText = el('div', 'goal-text');
  private speedBtns: HTMLButtonElement[] = [];
  private warnings = el('div', 'warnings');
  private palette = el('div', 'palette');
  private toolBtns = new Map<Tool, HTMLButtonElement>();
  private tooltip = el('div', 'tooltip hidden');
  private hint = el('div', 'hint hidden');
  private info = el('div', 'tile-info');
  private pausedEl = el('div', 'paused hidden', t.paused);
  private toasts = el('div', 'toasts');
  private overlay = el('div', 'overlay hidden');
  private lastState: GameState | null = null;

  constructor(readonly root: HTMLElement, private cb: UICallbacks) {
    this.buildHud();
    this.buildPalette();
    root.append(this.hud, this.warnings, this.palette, this.tooltip, this.hint, this.info, this.pausedEl, this.toasts, this.overlay);
    this.setPlaying(false);
  }

  /** Hide the in-game HUD while on the title screen. */
  setPlaying(on: boolean) {
    for (const e of [this.hud, this.warnings, this.palette, this.info]) e.classList.toggle('hidden', !on);
    if (!on) {
      this.hint.classList.add('hidden');
      this.pausedEl.classList.add('hidden');
      this.toasts.replaceChildren();
    }
  }

  private buildHud() {
    const brand = el('div', 'brand', '<span class="sim">Sim</span>Tlatoani');
    const res = el('div', 'resources');
    for (const r of RESOURCE_IDS) {
      const box = el('div', 'stat');
      box.title = t.resources[r];
      const value = el('span', 'value');
      const delta = el('span', 'delta');
      box.append(el('span', 'icon', RES_ICONS[r]), el('span', 'label', t.resources[r]), value, delta);
      this.resEls[r] = { value, delta };
      res.append(box);
    }
    const pop = el('div', 'stat');
    pop.title = `${t.population} / ${t.housing}`;
    pop.append(el('span', 'icon', '👥'), el('span', 'label', t.population), this.popEl, this.popDelta);
    const workers = el('div', 'stat');
    workers.title = t.workers;
    workers.append(el('span', 'icon', '⚒️'), el('span', 'label', t.workers), this.workersEl);
    const favor = el('div', 'stat favor');
    favor.title = t.favor;
    const bar = el('div', 'bar');
    bar.append(this.favorFill);
    favor.append(el('span', 'icon', '☀️'), el('span', 'label', t.favor), bar, this.favorVal);
    res.append(pop, workers, favor);

    const goal = el('div', 'goal');
    const gbar = el('div', 'bar');
    gbar.append(this.goalFill);
    goal.append(this.goalText, gbar);

    const speed = el('div', 'speed');
    for (const [n, label, title] of SPEEDS) {
      const b = el('button', 'btn small', label);
      b.title = title;
      b.dataset.speed = String(n);
      b.onclick = () => this.cb.setSpeed(n);
      this.speedBtns.push(b);
      speed.append(b);
    }
    const menu = el('button', 'btn small', t.menu);
    menu.dataset.action = 'menu';
    menu.onclick = () => this.showMenu();
    speed.append(menu);

    const left = el('div', 'hud-left');
    left.append(brand, this.dateEl);
    const right = el('div', 'hud-right');
    right.append(goal, speed);
    this.hud.append(left, res, right);
  }

  private buildPalette() {
    const tools: Tool[] = [...BUILD_ORDER, 'demoler'];
    tools.forEach((tool, i) => {
      const b = el('button', 'tool');
      b.dataset.tool = tool;
      const icon = document.createElement('canvas');
      icon.width = 80;
      icon.height = 80;
      const g = icon.getContext('2d')!;
      g.scale(2, 2);
      if (tool === 'demoler') {
        g.font = '26px serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('🔨', 20, 22);
      } else {
        const bg = BUILDINGS[tool].allowed[0];
        g.fillStyle = TERRAIN_COLORS[bg === T.MARSH && tool === 'calli' ? T.ISLAND : bg];
        g.beginPath();
        g.roundRect(0, 0, 40, 40, 6);
        g.fill();
        drawBuilding(g, tool, 4, 4, 32, 0.2);
      }
      const name = tool === 'demoler' ? t.demolish.name : t.buildings[tool].name;
      const cost = tool === 'demoler' ? '' : costHtml(BUILDINGS[tool].cost);
      b.append(icon, el('span', 'name', name), el('span', 'cost', cost), el('kbd', '', String(i + 1)));
      b.onclick = () => this.cb.selectTool(tool);
      b.onmouseenter = () => this.showTooltip(tool, b);
      b.onmouseleave = () => this.tooltip.classList.add('hidden');
      this.toolBtns.set(tool, b);
      this.palette.append(b);
    });
  }

  private showTooltip(tool: Tool, anchor: HTMLElement) {
    if (tool === 'demoler') {
      this.tooltip.innerHTML = `<h3>${t.demolish.name}</h3><p>${t.demolish.desc}</p><p class="rule">${t.demolish.rule}</p>`;
    } else {
      const d = BUILDINGS[tool];
      const s = t.buildings[tool];
      const extra = [
        d.workers ? t.workersNeeded(d.workers) : '',
        d.housing ? t.housingFor(d.housing) : '',
        tool === 'albarradon' && this.lastState ? `${this.lastState.buildings.filter((b) => b === 'albarradon').length}/${DIKE_SEGMENTS}` : '',
      ].filter(Boolean);
      this.tooltip.innerHTML =
        `<h3>${s.name}</h3><p>${s.desc}</p><p class="rule">${s.rule}</p>` +
        `<p class="cost-line"><b>${t.cost}:</b> ${costHtml(d.cost)}</p>` +
        extra.map((e) => `<p class="extra">${e}</p>`).join('');
    }
    this.tooltip.classList.remove('hidden');
    const r = anchor.getBoundingClientRect();
    const w = this.tooltip.offsetWidth;
    this.tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    this.tooltip.style.bottom = `${window.innerHeight - r.top + 8}px`;
  }

  update(s: GameState, info: HudInfo) {
    this.lastState = s;
    this.dateEl.textContent = t.date(s.day);
    for (const r of RESOURCE_IDS) {
      this.resEls[r].value.textContent = fmt(s.res[r]);
      setDelta(this.resEls[r].delta, s.delta[r]);
    }
    this.popEl.textContent = `${fmt(s.population)} / ${fmt(info.housing)}`;
    setDelta(this.popDelta, s.delta.population);
    this.workersEl.textContent = `${fmt(Math.min(info.workforce, info.jobs))} / ${fmt(info.jobs)}`;
    this.favorFill.style.width = `${s.favor}%`;
    this.favorFill.className = `fill ${s.favor < 25 ? 'bad' : s.favor < 50 ? 'warn' : 'good'}`;
    this.favorVal.textContent = `${Math.floor(s.favor)}`;
    const pct = Math.min(100, Math.floor((s.population / GOAL_POPULATION) * 100));
    this.goalText.textContent = t.goal(pct);
    this.goalFill.style.width = `${pct}%`;
    for (const b of this.speedBtns) b.classList.toggle('active', Number(b.dataset.speed) === info.speed);
    this.pausedEl.classList.toggle('hidden', info.speed !== 0 || this.modalOpen);

    for (const [tool, b] of this.toolBtns) {
      b.classList.toggle('active', tool === info.tool);
      if (tool !== 'demoler') b.classList.toggle('poor', missingFor(s, BUILDINGS[tool].cost) !== null);
    }
    if (info.tool) {
      this.hint.textContent = info.tool === 'demoler' ? t.demolishHint : t.toolHint(t.buildings[info.tool].name);
      this.hint.classList.remove('hidden');
    } else this.hint.classList.add('hidden');

    const warn: [string, string][] = [];
    const hasMainland = info.counts.lenadores + info.counts.cantera > 0;
    if (!info.connected && (hasMainland || s.day > 15)) warn.push([t.warnings.notConnected, 'bad']);
    if (s.famine) warn.push([t.warnings.famine, 'bad']);
    else if (s.delta.maiz < 0 && s.res.maiz < -s.delta.maiz * 20) warn.push([t.warnings.lowFood, 'warn']);
    if (s.droughtDays > 0) warn.push([t.warnings.drought(s.droughtDays), 'warn']);
    if (s.favor < 25) warn.push([t.warnings.lowFavor, 'bad']);
    if (info.staffing < 0.95) warn.push([t.warnings.fewWorkers(Math.round(info.staffing * 100)), 'warn']);
    if (s.population >= info.housing && info.housing > 0 && !s.famine) warn.push([t.warnings.noHousing, 'info']);
    const html = warn.map(([w, k]) => `<div class="chip ${k}">${w}</div>`).join('');
    if (this.warnings.innerHTML !== html) this.warnings.innerHTML = html;
  }

  setTileInfo(text: string) {
    this.info.textContent = text;
  }

  toast(text: string, kind: LogKind = 'info') {
    const e = el('div', `toast ${kind}`, '');
    e.textContent = text;
    this.toasts.prepend(e);
    while (this.toasts.children.length > 5) this.toasts.lastElementChild!.remove();
    setTimeout(() => e.classList.add('fade'), 5500);
    setTimeout(() => e.remove(), 6200);
  }

  // ---- Modals ----

  private openModal(kind: NonNullable<UI['modalKind']>, content: HTMLElement, wide = false) {
    this.overlay.replaceChildren();
    const panel = el('div', `panel ${wide ? 'wide' : ''} ${kind}`);
    panel.append(content);
    this.overlay.append(panel);
    this.overlay.classList.remove('hidden');
    this.modalOpen = true;
    this.modalKind = kind;
    this.tooltip.classList.add('hidden');
  }

  closeModal() {
    this.overlay.classList.add('hidden');
    this.overlay.replaceChildren();
    this.modalOpen = false;
    this.modalKind = null;
  }

  private button(label: string, action: () => void, primary = false, disabled = false, id = '') {
    const b = el('button', `btn ${primary ? 'primary' : ''}`, label);
    if (id) b.dataset.action = id;
    b.disabled = disabled;
    b.onclick = action;
    return b;
  }

  showTitle(hasSave: boolean) {
    const c = el('div', 'title-screen');
    c.append(
      el('h1', 'logo', '<span class="sim">Sim</span>Tlatoani'),
      el('p', 'tagline', t.tagline),
    );
    const btns = el('div', 'buttons');
    btns.append(
      this.button(t.newGame, () => this.cb.newGame(), true, false, 'new-game'),
      this.button(t.continueGame, () => this.cb.continueGame(), false, !hasSave),
      this.button(t.howToPlay, () => this.showHelp(() => this.showTitle(hasSave))),
    );
    c.append(btns);
    this.openModal('title', c);
  }

  showHelp(back: () => void) {
    const c = el('div', 'help');
    c.append(el('h2', '', t.helpTitle));
    for (const p of t.help) c.append(el('p', '', p));
    const btns = el('div', 'buttons');
    btns.append(this.button(t.back, back, true));
    c.append(btns);
    this.openModal('help', c, true);
  }

  showMenu() {
    const c = el('div', 'menu');
    c.append(el('h2', '', t.menu));
    const btns = el('div', 'buttons column');
    btns.append(
      this.button(t.resume, () => this.cb.resume(), true),
      this.button(t.saveGame, () => this.cb.save()),
      this.button(t.howToPlay, () => this.showHelp(() => this.showMenu())),
      this.button(t.quitToTitle, () => this.cb.quitToTitle()),
    );
    c.append(btns);
    this.openModal('menu', c);
  }

  showEnd(s: GameState, counts: Record<BuildingId, number>) {
    const won = s.status === 'won';
    const c = el('div', `end ${won ? 'won' : 'lost'}`);
    const text = won ? t.win : s.lostReason === 'favor' ? t.lose.favor : t.lose.population;
    c.append(el('h2', '', text.title));
    c.append(el('p', '', won ? t.win.body(s.day, s.population) : `${t.lose.favor === text ? t.lose.favor.body : t.lose.population.body} ${t.lose.survived(s.day)}`));
    const stats = el('div', 'stats');
    stats.innerHTML = [
      `<div><b>${fmt(s.population)}</b><span>${t.population}</span></div>`,
      `<div><b>${fmt(s.day)}</b><span>días</span></div>`,
      `<div><b>${counts.calli}</b><span>${t.buildings.calli.name}</span></div>`,
      `<div><b>${counts.chinampa}</b><span>${t.buildings.chinampa.name}s</span></div>`,
      `<div><b>${counts.teocalli}</b><span>${t.buildings.teocalli.name}</span></div>`,
    ].join('');
    c.append(stats);
    const btns = el('div', 'buttons');
    if (won) btns.append(this.button(t.keepPlaying, () => this.cb.keepPlaying(), true));
    btns.append(this.button(t.newGame, () => this.cb.newGame(), !won));
    if (!won) btns.append(this.button(t.quitToTitle, () => this.cb.quitToTitle()));
    c.append(btns);
    this.openModal('end', c);
  }
}

function setDelta(e: HTMLElement, d: number) {
  const r = Math.round(d * 10) / 10;
  e.textContent = r === 0 ? '' : `${r > 0 ? '+' : ''}${r.toLocaleString('es-MX')}`;
  e.className = `delta ${r > 0 ? 'up' : r < 0 ? 'down' : ''}`;
}
