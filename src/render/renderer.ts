import { isConnected, MAINLAND_BUILDINGS, type BuildingId } from '../sim/buildings';
import { inBounds, type GameState } from '../sim/state';
import { isLand, T } from '../sim/terrain';
import { drawBuilding, E, hash, N, S, shade, TERRAIN_COLORS, W } from './draw';

export const TILE = 24;

export interface Camera {
  /** World-pixel coordinates at the center of the screen. */
  cx: number;
  cy: number;
  zoom: number;
}

export interface Hover {
  x: number;
  y: number;
  /** Tool being previewed, and whether it can be placed. */
  tool: BuildingId | 'demoler' | null;
  ok: boolean;
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;
  private dpr = 1;
  private terrainCanvas: HTMLCanvasElement | null = null;
  private terrainOf: unknown = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }

  screenToWorld(sx: number, sy: number, cam: Camera) {
    return { x: (sx - this.width / 2) / cam.zoom + cam.cx, y: (sy - this.height / 2) / cam.zoom + cam.cy };
  }

  private buildTerrain(s: GameState) {
    const c = document.createElement('canvas');
    c.width = s.width * TILE;
    c.height = s.height * TILE;
    const g = c.getContext('2d')!;
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const t = s.terrain[y * s.width + x];
        const h = hash(x, y);
        const px = x * TILE;
        const py = y * TILE;
        g.fillStyle = shade(TERRAIN_COLORS[t], (h - 0.5) * 0.05);
        g.fillRect(px, py, TILE, TILE);
        const h2 = hash(x + 101, y + 7);
        if (t === T.FOREST) {
          for (let k = 0; k < 3; k++) {
            const ox = hash(x * 3 + k, y) * 0.6 + 0.2;
            const oy = hash(x, y * 3 + k) * 0.6 + 0.2;
            g.fillStyle = k % 2 ? '#2f5a22' : '#3c6b2b';
            g.beginPath();
            g.arc(px + ox * TILE, py + oy * TILE, TILE * (0.18 + h2 * 0.06), 0, Math.PI * 2);
            g.fill();
          }
        } else if (t === T.ROCK) {
          g.fillStyle = '#a69e90';
          g.beginPath();
          g.moveTo(px + TILE * 0.15, py + TILE * 0.8);
          g.lineTo(px + TILE * (0.4 + h * 0.2), py + TILE * 0.2);
          g.lineTo(px + TILE * 0.85, py + TILE * 0.8);
          g.fill();
          g.fillStyle = '#6f685c';
          g.fillRect(px + TILE * 0.2, py + TILE * 0.78, TILE * 0.6, TILE * 0.06);
        } else if (t === T.MARSH) {
          g.strokeStyle = '#3f6e57';
          g.lineWidth = 1;
          for (let k = 0; k < 3; k++) {
            const ox = px + TILE * (0.2 + hash(x + k, y * 2) * 0.6);
            const oy = py + TILE * (0.3 + hash(x * 2, y + k) * 0.5);
            g.beginPath();
            g.moveTo(ox, oy + 5);
            g.lineTo(ox - 1, oy);
            g.moveTo(ox + 2, oy + 5);
            g.lineTo(ox + 3, oy + 1);
            g.stroke();
          }
        } else if (t === T.ISLAND || t === T.MAINLAND) {
          if (h2 > 0.6) {
            g.fillStyle = shade(TERRAIN_COLORS[t], -0.08);
            g.fillRect(px + TILE * h, py + TILE * h2 * 0.8, 2, 2);
          }
        }
        // Shoreline: darken land edges that touch water or marsh.
        if (isLand(t)) {
          g.fillStyle = 'rgba(60,40,20,0.35)';
          const water = (nx: number, ny: number) =>
            inBounds(s, nx, ny) && !isLand(s.terrain[ny * s.width + nx]);
          if (water(x, y - 1)) g.fillRect(px, py, TILE, 2);
          if (water(x, y + 1)) g.fillRect(px, py + TILE - 2, TILE, 2);
          if (water(x - 1, y)) g.fillRect(px, py, 2, TILE);
          if (water(x + 1, y)) g.fillRect(px + TILE - 2, py, 2, TILE);
        }
      }
    }
    this.terrainCanvas = c;
    this.terrainOf = s.terrain;
  }

  render(s: GameState, cam: Camera, hover: Hover | null, time: number, grid: boolean) {
    if (this.terrainOf !== s.terrain) this.buildTerrain(s);
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = TERRAIN_COLORS[T.DEEP];
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.cx, -cam.cy);
    ctx.imageSmoothingEnabled = cam.zoom < 1;
    ctx.drawImage(this.terrainCanvas!, 0, 0);

    const tl = this.screenToWorld(0, 0, cam);
    const br = this.screenToWorld(this.width, this.height, cam);
    const x0 = Math.max(0, Math.floor(tl.x / TILE));
    const y0 = Math.max(0, Math.floor(tl.y / TILE));
    const x1 = Math.min(s.width - 1, Math.floor(br.x / TILE));
    const y1 = Math.min(s.height - 1, Math.floor(br.y / TILE));

    // Water glints
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * s.width + x;
        const t = s.terrain[i];
        if ((t !== T.DEEP && t !== T.SHALLOW) || s.buildings[i]) continue;
        const h = hash(x, y);
        if (h > 0.18) continue;
        const phase = Math.sin(time / 900 + h * 60);
        const gx = x * TILE + TILE * (0.2 + h * 3) + phase * 2;
        const gy = y * TILE + TILE * (0.3 + h * 2);
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + 6, gy);
      }
    }
    ctx.stroke();

    const connected = isConnected(s);
    const linearMask = (x: number, y: number, kind: BuildingId) => {
      let m = 0;
      const ok = (nx: number, ny: number) => {
        if (!inBounds(s, nx, ny)) return false;
        const j = ny * s.width + nx;
        return s.buildings[j] === kind || isLand(s.terrain[j]);
      };
      if (ok(x, y - 1)) m |= N;
      if (ok(x + 1, y)) m |= E;
      if (ok(x, y + 1)) m |= S;
      if (ok(x - 1, y)) m |= W;
      return m;
    };

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const b = s.buildings[y * s.width + x];
        if (!b) continue;
        const mask = b === 'calzada' || b === 'albarradon' ? linearMask(x, y, b) : undefined;
        drawBuilding(ctx, b, x * TILE, y * TILE, TILE, hash(x + 31, y + 17), mask);
        if (!connected && MAINLAND_BUILDINGS.includes(b)) this.warnMark(x, y, time);
      }
    }

    if (grid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      for (let x = x0; x <= x1 + 1; x++) {
        ctx.moveTo(x * TILE, y0 * TILE);
        ctx.lineTo(x * TILE, (y1 + 1) * TILE);
      }
      for (let y = y0; y <= y1 + 1; y++) {
        ctx.moveTo(x0 * TILE, y * TILE);
        ctx.lineTo((x1 + 1) * TILE, y * TILE);
      }
      ctx.stroke();
    }

    if (hover && inBounds(s, hover.x, hover.y)) {
      const px = hover.x * TILE;
      const py = hover.y * TILE;
      if (hover.tool && hover.tool !== 'demoler' && hover.ok) {
        ctx.globalAlpha = 0.65;
        drawBuilding(ctx, hover.tool, px, py, TILE, 0.2, linearMask(hover.x, hover.y, hover.tool));
        ctx.globalAlpha = 1;
      }
      if (hover.tool) {
        const good = hover.tool === 'demoler' ? hover.ok : hover.ok;
        const color = hover.tool === 'demoler' ? (good ? '230,90,60' : '200,200,200') : good ? '90,230,120' : '240,70,60';
        ctx.fillStyle = `rgba(${color},0.25)`;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = `rgba(${color},0.95)`;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      }
      ctx.lineWidth = 2 / cam.zoom;
      ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
    }
  }

  private warnMark(x: number, y: number, time: number) {
    const ctx = this.ctx;
    const r = TILE * 0.2;
    const cx = x * TILE + TILE * 0.82;
    const cy = y * TILE + TILE * 0.18 + Math.sin(time / 250) * 1.5;
    ctx.fillStyle = '#d23a2a';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 1, cy - r * 0.6, 2, r * 0.75);
    ctx.fillRect(cx - 1, cy + r * 0.3, 2, 2);
  }
}
