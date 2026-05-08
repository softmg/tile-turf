import { useEffect, useRef, useState } from "react";
import { Application, CanvasSource, Container, Graphics, Rectangle, Sprite, Texture, FederatedPointerEvent } from "pixi.js";
import backgroundUrl from "@/assets/background.png";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

const TILE_W = 110;
const TILE_H = 70;
const TILE_SIZE = 120;

// ---------- Skin System ----------
export type SkinId = "plush" | "girl" | "alien" | "knight";

export interface SkinConfig {
  id: SkinId;
  name: string;
  playerSprite: string;
  tileSprite: string;
  minimapColor: number; // hex 0xRRGGBB
  uiColor: string;      // CSS color for React UI
}

// Placeholder art via placehold.co — swap with real assets later.
export const SKINS: Record<SkinId, SkinConfig> = {
  plush: {
    id: "plush",
    name: "Plush",
    playerSprite: "https://placehold.co/180x220/8b5a2b/ffffff/png?text=Plush",
    tileSprite:   "https://placehold.co/240x240/8b5a2b/ffe4b5/png?text=+",
    minimapColor: 0x8b5a2b,
    uiColor: "#8b5a2b",
  },
  girl: {
    id: "girl",
    name: "Girl",
    playerSprite: "https://placehold.co/180x220/ff69b4/ffffff/png?text=Girl",
    tileSprite:   "https://placehold.co/240x240/ff69b4/ffe4f1/png?text=+",
    minimapColor: 0xff69b4,
    uiColor: "#ff69b4",
  },
  alien: {
    id: "alien",
    name: "Alien",
    playerSprite: "https://placehold.co/180x220/32cd32/ffffff/png?text=Alien",
    tileSprite:   "https://placehold.co/240x240/32cd32/eaffea/png?text=+",
    minimapColor: 0x32cd32,
    uiColor: "#32cd32",
  },
  knight: {
    id: "knight",
    name: "Knight",
    playerSprite: "https://placehold.co/180x220/708090/ffffff/png?text=Knight",
    tileSprite:   "https://placehold.co/240x240/708090/e6ecf2/png?text=+",
    minimapColor: 0x708090,
    uiColor: "#708090",
  },
};

const UNPAINTED_TILE_URL = "https://placehold.co/240x240/f5d0b0/c08a5a/png?text=+";
const UNPAINTED_MINIMAP_COLOR = 0xf5d0b0;

const PLAYER_SKIN: SkinId = "plush";
const ENEMY_SKIN: SkinId = "girl";

export function IsoGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [debug, setDebug] = useState(false);
  const debugRef = useRef(false);
  const [stats, setStats] = useState({ fps: 0, frameMs: 0, maxMs: 0 });
  const statsAccum = useRef({ frames: 0, sumMs: 0, maxMs: 0, lastFlush: 0 });
  const [scores, setScores] = useState<Record<SkinId, number>>({ plush: 0, girl: 0, alien: 0, knight: 0 });

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { debugRef.current = debug; }, [debug]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const app = new Application();
    let destroyed = false;
    let keyHandler: ((e: KeyboardEvent) => void) | null = null;
    let resizeHandler: (() => void) | null = null;

    (async () => {
      try {
        await app.init({
          resizeTo: window,
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 3),
          autoDensity: true,
          preference: "webgl",
        });
      } catch (err) {
        console.error("[IsoGrid] Pixi init failed", err);
        return;
      }
      if (destroyed) {
        app.destroy(true, { children: true });
        return;
      }
      host.appendChild(app.canvas);
      console.log("[IsoGrid] canvas appended", app.canvas.width, app.canvas.height);
      window.addEventListener("error", (e) => console.error("[IsoGrid] window error", e.error || e.message));
      window.addEventListener("unhandledrejection", (e) => console.error("[IsoGrid] unhandled rejection", e.reason));




      // Use the built-in WHITE texture and tint sprites — bypasses any
      // texture-creation pitfalls in Pixi v8 with custom canvases.
      const whiteTex = Texture.WHITE;
      const skinTextures: Record<SkinId, { tile: Texture; player: Texture }> = {
        plush:  { tile: whiteTex, player: whiteTex },
        girl:   { tile: whiteTex, player: whiteTex },
        alien:  { tile: whiteTex, player: whiteTex },
        knight: { tile: whiteTex, player: whiteTex },
      };
      const unpaintedTex = whiteTex;
      console.log("[IsoGrid] textures ready");


      const world = new Container();
      world.sortableChildren = true;
      app.stage.addChild(world);
      app.stage.sortableChildren = true;

      const isoPos = (x: number, y: number) => ({
        x: (x - y) * (TILE_W / 2),
        y: (x + y) * (TILE_H / 2),
      });

      // Tile ownership: null = unpainted, else SkinId
      const owners: (SkinId | null)[][] = [];
      const tiles: Sprite[][] = [];
      for (let x = 0; x < 8; x++) {
        tiles[x] = [];
        owners[x] = [];
        for (let y = 0; y < 8; y++) {
          const tile = new Sprite(unpaintedTex as Texture);
          tile.anchor.set(0.5, 0.5);
          tile.width = TILE_SIZE;
          tile.height = TILE_SIZE;
          tile.tint = UNPAINTED_MINIMAP_COLOR;
          const p = isoPos(x, y);
          tile.x = p.x;
          tile.y = p.y;
          tile.zIndex = x + y;
          world.addChild(tile);
          tiles[x][y] = tile;
          owners[x][y] = null;
        }
      }

      // ---------- Characters ----------
      interface Character {
        skin: SkinConfig;
        sprite: Sprite;
        shadow: Graphics;
        gx: number;
        gy: number;
        anim: { fromX: number; fromY: number; toX: number; toY: number; elapsed: number } | null;
      }

      const makeCharacter = (skinId: SkinId, gx: number, gy: number): Character => {
        const skin = SKINS[skinId];
        const shadow = new Graphics();
        shadow.ellipse(0, 0, 28, 12).fill({ color: 0x000000, alpha: 0.35 });
        world.addChild(shadow);
        const sprite = new Sprite(whiteTex);
        sprite.anchor.set(0.5, 0.85);
        sprite.width = 60;
        sprite.height = 90;
        sprite.tint = skin.minimapColor;
        world.addChild(sprite);
        return { skin, sprite, shadow, gx, gy, anim: null };
      };

      const player = makeCharacter(PLAYER_SKIN, 0, 0);
      const enemy = makeCharacter(ENEMY_SKIN, 7, 7);

      const JUMP_DURATION = 380;

      // ---------- Minimap ----------
      const MINI_CELL = 10;
      const MINI_SIZE = 8 * MINI_CELL;
      const minimap = new Container();
      minimap.zIndex = 999;
      app.stage.addChild(minimap);

      const miniBg = new Graphics();
      miniBg.rect(-4, -4, MINI_SIZE + 8, MINI_SIZE + 8).fill({ color: 0x000000, alpha: 0.5 });
      minimap.addChild(miniBg);

      const miniTiles: Graphics[][] = [];
      for (let x = 0; x < 8; x++) {
        miniTiles[x] = [];
        for (let y = 0; y < 8; y++) {
          const m = new Graphics();
          m.rect(x * MINI_CELL, y * MINI_CELL, MINI_CELL - 1, MINI_CELL - 1).fill(UNPAINTED_MINIMAP_COLOR);
          minimap.addChild(m);
          miniTiles[x][y] = m;
        }
      }

      const miniPlayer = new Graphics();
      miniPlayer.circle(0, 0, 3).fill(0xffffff);
      miniPlayer.zIndex = 10;
      minimap.addChild(miniPlayer);

      const miniEnemy = new Graphics();
      miniEnemy.circle(0, 0, 3).stroke({ width: 1.5, color: 0xffffff }).fill(SKINS[ENEMY_SKIN].minimapColor);
      miniEnemy.zIndex = 10;
      minimap.addChild(miniEnemy);

      const positionMinimap = () => {
        minimap.x = app.screen.width - MINI_SIZE - 20;
        minimap.y = 20;
      };

      const recomputeScores = () => {
        const next: Record<SkinId, number> = { plush: 0, girl: 0, alien: 0, knight: 0 };
        for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
          const o = owners[x][y];
          if (o) next[o]++;
        }
        setScores(next);
      };

      const updateMinimap = () => {
        for (let x = 0; x < 8; x++) {
          for (let y = 0; y < 8; y++) {
            const m = miniTiles[x][y];
            const o = owners[x][y];
            const color = o ? SKINS[o].minimapColor : UNPAINTED_MINIMAP_COLOR;
            m.clear();
            m.rect(x * MINI_CELL, y * MINI_CELL, MINI_CELL - 1, MINI_CELL - 1).fill(color);
          }
        }
        miniPlayer.x = player.gx * MINI_CELL + MINI_CELL / 2;
        miniPlayer.y = player.gy * MINI_CELL + MINI_CELL / 2;
        miniEnemy.x = enemy.gx * MINI_CELL + MINI_CELL / 2;
        miniEnemy.y = enemy.gy * MINI_CELL + MINI_CELL / 2;
      };

      let cameraTargetX = 0;
      let cameraTargetY = 0;
      let cameraInitialized = false;

      const computeCameraTarget = () => {
        const z = zoomRef.current;
        const p = isoPos(player.gx, player.gy);
        const minX = isoPos(0, 7).x;
        const maxX = isoPos(7, 0).x;
        const minY = isoPos(0, 0).y;
        const maxY = isoPos(7, 7).y;
        const gridW = (maxX - minX + TILE_SIZE) * z;
        const gridH = (maxY - minY + TILE_SIZE) * z;
        const gridCx = (minX + maxX) / 2;
        const gridCy = (minY + maxY) / 2;

        if (gridW <= app.screen.width && gridH <= app.screen.height) {
          cameraTargetX = app.screen.width / 2 - gridCx * z;
          cameraTargetY = app.screen.height / 2 - gridCy * z;
        } else {
          cameraTargetX = app.screen.width / 2 - p.x * z;
          cameraTargetY = app.screen.height / 2 - p.y * z;
        }
      };

      const centerCamera = () => {
        computeCameraTarget();
        if (!cameraInitialized) {
          world.scale.set(zoomRef.current);
          world.x = cameraTargetX;
          world.y = cameraTargetY;
          cameraInitialized = true;
        }
      };

      const paintAt = (gx: number, gy: number, skin: SkinConfig) => {
        owners[gx][gy] = skin.id;
        tiles[gx][gy].tint = skin.minimapColor;
      };

      const renderCharacterAt = (c: Character, gx: number, gy: number, jumpOffset = 0, shadowScale = 1) => {
        const p = isoPos(gx, gy);
        c.sprite.x = p.x;
        c.sprite.y = p.y + jumpOffset;
        c.sprite.zIndex = gx + gy + 0.1;
        c.shadow.x = p.x;
        c.shadow.y = p.y;
        c.shadow.zIndex = gx + gy + 0.05;
        c.shadow.scale.set(shadowScale, shadowScale);
      };

      const land = (c: Character) => {
        paintAt(c.gx, c.gy, c.skin);
        renderCharacterAt(c, c.gx, c.gy);
      };

      // Initial paint
      land(player);
      land(enemy);
      positionMinimap();
      updateMinimap();
      recomputeScores();

      const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

      const moveCharacter = (c: Character, direction: Direction) => {
        if (c.anim) return;
        let nx = c.gx;
        let ny = c.gy;
        if (direction === "UP") ny -= 1;
        else if (direction === "DOWN") ny += 1;
        else if (direction === "LEFT") nx -= 1;
        else if (direction === "RIGHT") nx += 1;
        if (nx < 0 || nx > 7 || ny < 0 || ny > 7) return;
        const fromX = c.gx;
        const fromY = c.gy;
        c.gx = nx;
        c.gy = ny;
        updateMinimap();
        c.anim = { fromX, fromY, toX: nx, toY: ny, elapsed: 0 };
      };

      const movePlayer = (d: Direction) => moveCharacter(player, d);

      // Enemy AI: random walk every ~700ms
      const DIRS: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];
      let enemyTimer = 0;
      const ENEMY_INTERVAL = 700;

      app.ticker.add((ticker) => {
        const dtMs = ticker.deltaMS;

        if (debugRef.current) {
          const s = statsAccum.current;
          s.frames += 1;
          s.sumMs += dtMs;
          if (dtMs > s.maxMs) s.maxMs = dtMs;
          const now = performance.now();
          if (s.lastFlush === 0) s.lastFlush = now;
          if (now - s.lastFlush >= 200) {
            const avg = s.sumMs / Math.max(1, s.frames);
            setStats({
              fps: Math.round(1000 / Math.max(0.001, avg)),
              frameMs: +avg.toFixed(2),
              maxMs: +s.maxMs.toFixed(2),
            });
            s.frames = 0; s.sumMs = 0; s.maxMs = 0; s.lastFlush = now;
          }
        }

        const zSmooth = 1 - Math.exp(-dtMs / 100);
        const curScale = world.scale.x;
        world.scale.set(curScale + (zoomRef.current - curScale) * zSmooth);

        computeCameraTarget();
        const camSmooth = 1 - Math.exp(-dtMs / 80);
        world.x += (cameraTargetX - world.x) * camSmooth;
        world.y += (cameraTargetY - world.y) * camSmooth;

        // Animate characters
        let landedAny = false;
        for (const c of [player, enemy]) {
          if (!c.anim) continue;
          c.anim.elapsed += dtMs;
          const linear = Math.min(1, c.anim.elapsed / JUMP_DURATION);
          const t = ease(linear);
          const gx = c.anim.fromX + (c.anim.toX - c.anim.fromX) * t;
          const gy = c.anim.fromY + (c.anim.toY - c.anim.fromY) * t;
          const jumpOffset = Math.sin(linear * Math.PI) * -55;
          const shadowScale = 1 - Math.sin(linear * Math.PI) * 0.5;
          renderCharacterAt(c, gx, gy, jumpOffset, shadowScale);
          if (linear >= 1) {
            c.anim = null;
            land(c);
            landedAny = true;
          }
        }
        if (landedAny) {
          updateMinimap();
          recomputeScores();
        }

        // Enemy AI tick
        enemyTimer += dtMs;
        if (enemyTimer >= ENEMY_INTERVAL && !enemy.anim) {
          enemyTimer = 0;
          const valid = DIRS.filter((d) => {
            let nx = enemy.gx, ny = enemy.gy;
            if (d === "UP") ny--; else if (d === "DOWN") ny++;
            else if (d === "LEFT") nx--; else nx++;
            return nx >= 0 && nx < 8 && ny >= 0 && ny < 8;
          });
          if (valid.length) moveCharacter(enemy, valid[Math.floor(Math.random() * valid.length)]);
        }
      });

      // ---------- Joystick ----------
      const joystick = new Container();
      joystick.zIndex = 1000;
      joystick.visible = false;
      joystick.scale.y = 0.5;
      app.stage.addChild(joystick);

      const base = new Graphics();
      base.circle(0, 0, 50).fill({ color: 0x3a1f10, alpha: 0.35 });
      joystick.addChild(base);

      const knob = new Graphics();
      knob.circle(0, 0, 25).fill({ color: 0xfff2e0, alpha: 0.85 });
      joystick.addChild(knob);

      const updateHitArea = () => {
        app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);
      };
      app.stage.eventMode = "static";
      updateHitArea();

      let isDragging = false;
      let baseX = 0;
      let baseY = 0;
      let lastMoveTime = 0;
      const MAX_RADIUS = 40;
      const THRESHOLD = 30;
      const COOLDOWN = 200;

      const onDown = (e: FederatedPointerEvent) => {
        baseX = e.global.x;
        baseY = e.global.y;
        joystick.x = baseX;
        joystick.y = baseY;
        knob.x = 0; knob.y = 0;
        joystick.visible = true;
        isDragging = true;
      };

      const onMove = (e: FederatedPointerEvent) => {
        if (!isDragging) return;
        const dx = e.global.x - baseX;
        const dy = e.global.y - baseY;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(dist, MAX_RADIUS);
        const angle = Math.atan2(dy, dx);
        knob.x = Math.cos(angle) * clamped;
        knob.y = (Math.sin(angle) * clamped) / 0.5;

        if (dist < THRESHOLD) return;
        const now = performance.now();
        if (now - lastMoveTime < COOLDOWN) return;

        const deg = (angle * 180) / Math.PI;
        let dir: Direction;
        if (deg >= -90 && deg < 0) dir = "UP";
        else if (deg >= 0 && deg < 90) dir = "RIGHT";
        else if (deg >= 90 && deg <= 180) dir = "DOWN";
        else dir = "LEFT";

        movePlayer(dir);
        lastMoveTime = now;
      };

      const onUp = () => {
        isDragging = false;
        joystick.visible = false;
      };

      app.stage.on("pointerdown", onDown);
      app.stage.on("pointermove", onMove);
      app.stage.on("pointerup", onUp);
      app.stage.on("pointerupoutside", onUp);

      keyHandler = (e: KeyboardEvent) => {
        let dir: Direction | null = null;
        switch (e.key) {
          case "ArrowUp": case "w": case "W": dir = "UP"; break;
          case "ArrowDown": case "s": case "S": dir = "DOWN"; break;
          case "ArrowLeft": case "a": case "A": dir = "LEFT"; break;
          case "ArrowRight": case "d": case "D": dir = "RIGHT"; break;
        }
        if (!dir) return;
        e.preventDefault();
        movePlayer(dir);
      };
      window.addEventListener("keydown", keyHandler);

      resizeHandler = () => {
        updateHitArea();
        positionMinimap();
        centerCamera();
      };
      window.addEventListener("resize", resizeHandler);
      centerCamera();

    })();


    return () => {
      destroyed = true;
      if (keyHandler) window.removeEventListener("keydown", keyHandler);
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      try {
        if (app.canvas && app.canvas.parentNode === host) host.removeChild(app.canvas);
        app.destroy(true, { children: true, texture: true });
      } catch {
        // ignore
      }
    };
  }, []);

  const playerSkin = SKINS[PLAYER_SKIN];
  const enemySkin = SKINS[ENEMY_SKIN];

  return (
    <>
      <div
        className="fixed inset-0"
        style={{
          touchAction: "none",
          userSelect: "none",
          backgroundImage: `url(${backgroundUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        ref={containerRef}
      />

      {/* Scoreboard */}
      <div
        className="fixed left-1/2 top-4 z-50 -translate-x-1/2 flex items-center gap-3 rounded-full bg-black/55 px-4 py-2 backdrop-blur-sm text-sm font-bold text-white shadow-lg"
        style={{ touchAction: "none" }}
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full ring-2 ring-white/30" style={{ background: playerSkin.uiColor }} />
          <span style={{ color: playerSkin.uiColor }}>{playerSkin.name}</span>
          <span className="tabular-nums">{scores[PLAYER_SKIN]}</span>
        </span>
        <span className="text-white/50">vs</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full ring-2 ring-white/30" style={{ background: enemySkin.uiColor }} />
          <span style={{ color: enemySkin.uiColor }}>{enemySkin.name}</span>
          <span className="tabular-nums">{scores[ENEMY_SKIN]}</span>
        </span>
      </div>

      <div
        className="fixed left-4 top-4 z-50 flex items-center gap-2 rounded-full bg-black/40 px-3 py-2 backdrop-blur-sm"
        style={{ touchAction: "none" }}
      >
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-base font-bold text-black active:scale-95"
          aria-label="Zoom out"
        >
          −
        </button>
        <input
          type="range"
          min={0.4}
          max={2}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="w-28 accent-white"
          aria-label="Zoom"
        />
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-base font-bold text-black active:scale-95"
          aria-label="Zoom in"
        >
          +
        </button>
        <span className="min-w-[2.5rem] text-right text-xs font-medium text-white/90 tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setDebug((d) => !d)}
          className={`ml-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider active:scale-95 ${
            debug ? "bg-emerald-400 text-black" : "bg-white/80 text-black"
          }`}
          aria-label="Toggle debug"
          aria-pressed={debug}
        >
          DBG
        </button>
      </div>
      {debug && (
        <div className="fixed right-4 bottom-4 z-50 rounded-lg bg-black/70 px-3 py-2 font-mono text-[11px] leading-tight text-emerald-300 backdrop-blur-sm tabular-nums">
          <div>FPS: {stats.fps}</div>
          <div>frame: {stats.frameMs.toFixed(2)} ms</div>
          <div>peak: {stats.maxMs.toFixed(2)} ms</div>
          <div className="text-white/60">DPR: {Math.min(window.devicePixelRatio || 1, 3)}</div>
        </div>
      )}
    </>
  );
}
