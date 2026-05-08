import { useEffect, useRef, useState } from "react";
import { Settings, Play } from "lucide-react";
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture, FederatedPointerEvent } from "pixi.js";
import backgroundUrl from "@/assets/background.png";
import playerUrl from "@/assets/player.png";
import tileUrl from "@/assets/tile.png";
import tilePaintedUrl from "@/assets/tile-painted.png";
import chestUrl from "@/assets/chest.png";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

const TILE_W = 110;
const TILE_H = 70;
const TILE_SIZE = 120;

// ---------- Skin System ----------
export type SkinId = "plush" | "girl" | "alien" | "knight" | "robot";

export interface SkinConfig {
  id: SkinId;
  name: string;
  playerSprite: string;
  tileSprite: string;
  minimapColor: number;
  uiColor: string;
  spriteTint: number;
}

export const SKINS: Record<SkinId, SkinConfig> = {
  plush: {
    id: "plush", name: "Plush",
    playerSprite: playerUrl, tileSprite: tilePaintedUrl,
    minimapColor: 0xe89a6a, uiColor: "#e89a6a", spriteTint: 0xffffff,
  },
  girl: {
    id: "girl", name: "Girl",
    playerSprite: playerUrl, tileSprite: tilePaintedUrl,
    minimapColor: 0xff7fb3, uiColor: "#ff7fb3", spriteTint: 0xffb6d4,
  },
  alien: {
    id: "alien", name: "Alien",
    playerSprite: playerUrl, tileSprite: tilePaintedUrl,
    minimapColor: 0x6ed36e, uiColor: "#6ed36e", spriteTint: 0xb8f2b8,
  },
  knight: {
    id: "knight", name: "Knight",
    playerSprite: playerUrl, tileSprite: tilePaintedUrl,
    minimapColor: 0x9aa6b8, uiColor: "#9aa6b8", spriteTint: 0xd0d8e4,
  },
  robot: {
    id: "robot", name: "Robot",
    playerSprite: playerUrl, tileSprite: tilePaintedUrl,
    minimapColor: 0x9b87f5, uiColor: "#9b87f5", spriteTint: 0xc4b4ff,
  },
};

const UNPAINTED_TILE_URL = tileUrl;
const UNPAINTED_MINIMAP_COLOR = 0xf5d0b0;

const PLAYER_SKIN: SkinId = "plush";
const BOT_SKINS: SkinId[] = ["girl", "alien", "knight", "robot"];
const SKIN_IDS: SkinId[] = ["plush", "girl", "alien", "knight", "robot"];
const ZERO_SCORES = (): Record<SkinId, number> => ({ plush: 0, girl: 0, alien: 0, knight: 0, robot: 0 });

export function IsoGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [debug, setDebug] = useState(false);
  const debugRef = useRef(false);
  const [stats, setStats] = useState({ fps: 0, frameMs: 0, maxMs: 0 });
  const statsAccum = useRef({ frames: 0, sumMs: 0, maxMs: 0, lastFlush: 0 });
  const [scores, setScores] = useState<Record<SkinId, number>>(() => ZERO_SCORES());
  const [banked, setBanked] = useState<Record<SkinId, number>>(() => ZERO_SCORES());
  const ROUND_DURATION = 90;
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
  const [gameOver, setGameOver] = useState(false);
  const gameOverRef = useRef(false);
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const kickoffRef = useRef<(() => void) | null>(null);
  const [botCount, setBotCount] = useState(1);
  const botCountRef = useRef(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => { botCountRef.current = botCount; }, [botCount]);
  const activeBotSkins: SkinId[] = BOT_SKINS.slice(0, botCount);
  const activeSkins: SkinId[] = [PLAYER_SKIN, ...activeBotSkins];
  const timeoutsRef = useRef<Set<number>>(new Set());
  const intervalsRef = useRef<Set<number>>(new Set());

  useEffect(() => { startedRef.current = started; }, [started]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => {
    if (started) kickoffRef.current?.();
  }, [started]);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Pinch-to-zoom (two fingers)
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let startDist = 0;
    let startZoom = 1;
    const dist = () => {
      const pts = Array.from(pointers.values());
      if (pts.length < 2) return 0;
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      return Math.hypot(dx, dy);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        startDist = dist();
        startZoom = zoomRef.current;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && startDist > 0) {
        const d = dist();
        const next = Math.min(2, Math.max(0.4, +(startZoom * (d / startDist)).toFixed(2)));
        setZoom(next);
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) startDist = 0;
    };
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);
    return () => {
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
    };
  }, []);

  useEffect(() => { debugRef.current = debug; }, [debug]);
  useEffect(() => {
    gameOverRef.current = gameOver;
    if (gameOver) {
      for (const id of timeoutsRef.current) window.clearTimeout(id);
      timeoutsRef.current.clear();
      for (const id of intervalsRef.current) window.clearInterval(id);
      intervalsRef.current.clear();
    }
  }, [gameOver]);

  // Round countdown timer
  useEffect(() => {
    if (gameOver || !started || paused) return;
    const id = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(id);
          setGameOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [gameOver, started, paused]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const app = new Application();
    let destroyed = false;
    let keyHandler: ((e: KeyboardEvent) => void) | null = null;
    let resizeHandler: (() => void) | null = null;
    let scheduledTimeouts: Set<number> | null = null;
    let scheduledIntervals: Set<number> | null = null;

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




      // Load uploaded local PNG assets via Pixi's Assets pipeline.
      // Local Vite-served files have proper extensions and no CORS issues.
      const [unpaintedTex, paintedTex, playerTex, chestTex] = await Promise.all([
        Assets.load<Texture>(UNPAINTED_TILE_URL),
        Assets.load<Texture>(tilePaintedUrl),
        Assets.load<Texture>(playerUrl),
        Assets.load<Texture>(chestUrl),
      ]);
      if (destroyed) return;
      for (const t of [unpaintedTex, paintedTex, playerTex, chestTex]) {
        if (t?.source) {
          t.source.scaleMode = "linear";
          t.source.autoGenerateMipmaps = true;
          t.source.updateMipmaps?.();
        }
      }
      const skinTextures: Record<SkinId, { tile: Texture; player: Texture }> = {
        plush:  { tile: paintedTex, player: playerTex },
        girl:   { tile: paintedTex, player: playerTex },
        alien:  { tile: paintedTex, player: playerTex },
        knight: { tile: paintedTex, player: playerTex },
        robot:  { tile: paintedTex, player: playerTex },
      };
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
          const tile = new Sprite(unpaintedTex);
          tile.anchor.set(0.5, 0.5);
          tile.width = TILE_SIZE;
          tile.height = TILE_SIZE;
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
        anim: { fromX: number; fromY: number; toX: number; toY: number; elapsed: number; duration: number } | null;
        stunnedUntil: number;
        boostUntil: number;
        aura: Graphics;
      }

      const makeCharacter = (skinId: SkinId, gx: number, gy: number): Character => {
        const skin = SKINS[skinId];
        const shadow = new Graphics();
        shadow.ellipse(0, 0, 28, 12).fill({ color: 0x000000, alpha: 0.35 });
        world.addChild(shadow);
        const aura = new Graphics();
        aura.circle(0, 0, 36).fill({ color: 0x00ffff, alpha: 0.35 }).stroke({ width: 2, color: 0x00ffff, alpha: 0.9 });
        aura.visible = false;
        world.addChild(aura);
        const tex = skinTextures[skinId].player;
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5, 0.85);
        const targetH = 110;
        const s = targetH / Math.max(tex.height, 1);
        sprite.scale.set(s);
        sprite.tint = skin.spriteTint;
        world.addChild(sprite);
        return { skin, sprite, shadow, gx, gy, anim: null, stunnedUntil: 0, boostUntil: 0, aura };
      };

      const player = makeCharacter(PLAYER_SKIN, 0, 0);
      // Pre-create all 4 possible bot characters; activate first N based on botCount.
      const ENEMY_SPAWN_POSITIONS: Array<[number, number]> = [[7, 7], [7, 0], [0, 7], [4, 4]];
      const allEnemies: Character[] = BOT_SKINS.map((sid, i) =>
        makeCharacter(sid, ENEMY_SPAWN_POSITIONS[i][0], ENEMY_SPAWN_POSITIONS[i][1])
      );
      const enemies: Character[] = allEnemies.slice(0, botCountRef.current);
      // Hide unused bot sprites
      for (let i = botCountRef.current; i < allEnemies.length; i++) {
        allEnemies[i].sprite.visible = false;
        allEnemies[i].shadow.visible = false;
      }

      const BASE_JUMP_DURATION = 380;
      const BOOST_JUMP_DURATION = 150;
      const STUN_DURATION = 2000;
      const BOOST_DURATION = 12000;
      const jumpDurationFor = (c: Character) =>
        performance.now() < c.boostUntil ? BOOST_JUMP_DURATION : BASE_JUMP_DURATION;


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

      const miniEnemies: Graphics[] = enemies.map((e) => {
        const g = new Graphics();
        g.circle(0, 0, 3).stroke({ width: 1.5, color: 0xffffff }).fill(SKINS[e.skin.id].minimapColor);
        g.zIndex = 10;
        minimap.addChild(g);
        return g;
      });

      const positionMinimap = () => {
        minimap.x = app.screen.width - MINI_SIZE - 16;
        minimap.y = app.screen.height - MINI_SIZE - 16;
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
        for (let i = 0; i < enemies.length; i++) {
          miniEnemies[i].x = enemies[i].gx * MINI_CELL + MINI_CELL / 2;
          miniEnemies[i].y = enemies[i].gy * MINI_CELL + MINI_CELL / 2;
        }
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
        const tile = tiles[gx][gy];
        tile.texture = skinTextures[skin.id].tile;
        tile.tint = skin.spriteTint;
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

      // ---------- Chest ----------
      const chestSprite = new Sprite(chestTex);
      chestSprite.anchor.set(0.5, 1);
      const chestTargetH = 80;
      const chestScale = chestTargetH / Math.max(chestTex.height, 1);
      chestSprite.scale.set(chestScale);
      world.addChild(chestSprite);
      const chest = { gx: 0, gy: 0, gfx: chestSprite };

      const spawnChest = () => {
        let gx = 0, gy = 0;
        for (let i = 0; i < 50; i++) {
          gx = Math.floor(Math.random() * 8);
          gy = Math.floor(Math.random() * 8);
          const occupied = [player, ...enemies].some((c) => c.gx === gx && c.gy === gy);
          if (!occupied) break;
        }
        chest.gx = gx;
        chest.gy = gy;
        const p = isoPos(gx, gy);
        chestSprite.x = p.x;
        chestSprite.y = p.y + 14;
        chestSprite.zIndex = gx + gy + 0.05;
      };


      const recomputeScores = () => {
        const next: Record<SkinId, number> = ZERO_SCORES();
        for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
          const o = owners[x][y];
          if (o) next[o]++;
        }
        setScores(next);
        return next;
      };

      const countOwned = (skinId: SkinId) => {
        let n = 0;
        for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) if (owners[x][y] === skinId) n++;
        return n;
      };

      const clearOwnedBy = (skinId: SkinId) => {
        for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
          if (owners[x][y] === skinId) {
            owners[x][y] = null;
            const t = tiles[x][y];
            t.texture = unpaintedTex;
            t.tint = 0xffffff;
          }
        }
      };

      const tryCollectChest = (c: Character) => {
        if (c.gx !== chest.gx || c.gy !== chest.gy) return false;
        const gained = countOwned(c.skin.id);
        if (gained > 0) {
          setBanked((prev) => ({ ...prev, [c.skin.id]: prev[c.skin.id] + gained }));
          clearOwnedBy(c.skin.id);
        }
        spawnChest();
        return true;
      };

      // ---------- Hazards (Bombs) & Boots ----------
      const pendingTimeouts = timeoutsRef.current;
      const pendingIntervals = intervalsRef.current;
      scheduledTimeouts = pendingTimeouts;
      scheduledIntervals = pendingIntervals;
      const setT = (fn: () => void, ms: number) => {
        const id = window.setTimeout(() => {
          pendingTimeouts.delete(id);
          if (gameOverRef.current || destroyed) return;
          fn();
        }, ms);
        pendingTimeouts.add(id);
        return id;
      };

      interface Bomb {
        gx: number; gy: number;
        warning: Graphics;
        boom: Graphics | null;
        phase: "warning" | "explosion";
      }
      const bombs: Bomb[] = [];

      const isWarningAt = (gx: number, gy: number) =>
        bombs.some((b) => b.phase === "warning" && b.gx === gx && b.gy === gy);

      const spawnBomb = () => {
        if (gameOverRef.current) return;
        if (pausedRef.current || !startedRef.current) { setT(spawnBomb, 800); return; }
        const gx = Math.floor(Math.random() * 8);
        const gy = Math.floor(Math.random() * 8);
        const p = isoPos(gx, gy);
        const warning = new Graphics();
        const drawWarning = (alpha: number) => {
          warning.clear();
          warning.circle(0, 0, 36).stroke({ width: 4, color: 0xff2222, alpha });
          warning.moveTo(-30, 0).lineTo(30, 0).stroke({ width: 3, color: 0xff2222, alpha });
          warning.moveTo(0, -22).lineTo(0, 22).stroke({ width: 3, color: 0xff2222, alpha });
        };
        drawWarning(1);
        warning.x = p.x;
        warning.y = p.y;
        warning.zIndex = gx + gy + 0.06;
        world.addChild(warning);
        const bomb: Bomb = { gx, gy, warning, boom: null, phase: "warning" };
        bombs.push(bomb);

        // Pulse warning
        let pulseT = 0;
        const pulseId = window.setInterval(() => {
          pulseT += 100;
          const a = 0.5 + 0.5 * Math.abs(Math.sin(pulseT / 180));
          drawWarning(a);
        }, 100);
        pendingIntervals.add(pulseId);

        setT(() => {
          window.clearInterval(pulseId);
          pendingIntervals.delete(pulseId);
          world.removeChild(warning);
          warning.destroy();
          bomb.phase = "explosion";

          // Explosion graphic
          const boom = new Graphics();
          boom.circle(0, 0, 42).fill({ color: 0xff5500, alpha: 0.9 });
          boom.circle(0, 0, 26).fill({ color: 0xfff2a0, alpha: 1 });
          boom.x = p.x; boom.y = p.y;
          boom.zIndex = gx + gy + 0.5;
          world.addChild(boom);
          bomb.boom = boom;

          // Impact: stun anyone on this tile (and not mid-air)
          for (const c of [player, ...enemies]) {
            if (c.gx === gx && c.gy === gy && !c.anim) {
              c.stunnedUntil = performance.now() + STUN_DURATION;
              clearOwnedBy(c.skin.id);
              recomputeScores();
              updateMinimap();
            }
          }

          setT(() => {
            world.removeChild(boom);
            boom.destroy();
            const i = bombs.indexOf(bomb);
            if (i >= 0) bombs.splice(i, 1);
          }, 500);
        }, 2000);

        // Schedule next bomb
        setT(spawnBomb, 5000 + Math.random() * 3000);
      };

      // Boots
      let boots: { gx: number; gy: number; gfx: Graphics } | null = null;
      const spawnBoots = () => {
        if (gameOverRef.current) return;
        if (pausedRef.current || !startedRef.current) { setT(spawnBoots, 800); return; }
        if (boots) return;
        const gx = Math.floor(Math.random() * 8);
        const gy = Math.floor(Math.random() * 8);
        const p = isoPos(gx, gy);
        const gfx = new Graphics();
        // boot body
        gfx.roundRect(-16, -28, 32, 18, 4).fill(0x00cccc).stroke({ width: 2, color: 0x004444 });
        gfx.roundRect(-16, -14, 28, 8, 3).fill(0x00ffff).stroke({ width: 2, color: 0x004444 });
        // wing
        gfx.moveTo(-18, -22).lineTo(-30, -28).lineTo(-18, -16).fill(0xffffff);
        // glow
        gfx.circle(0, -16, 22).stroke({ width: 2, color: 0x00ffff, alpha: 0.6 });
        gfx.x = p.x; gfx.y = p.y;
        gfx.zIndex = gx + gy + 0.06;
        world.addChild(gfx);
        boots = { gx, gy, gfx };
      };

      const tryCollectBoots = (c: Character) => {
        if (!boots) return;
        if (c.gx !== boots.gx || c.gy !== boots.gy) return;
        world.removeChild(boots.gfx);
        boots.gfx.destroy();
        boots = null;
        c.boostUntil = performance.now() + BOOST_DURATION;
        // Schedule next boots after 10-15s
        setT(spawnBoots, 10000 + Math.random() * 5000);
      };

      // ---------- Rotating Arrow ----------
      // dir: 0=UP, 1=RIGHT, 2=DOWN, 3=LEFT
      let arrow: {
        gx: number; gy: number; dir: number;
        gfx: Graphics; rotateId: number; despawnId: number;
      } | null = null;

      const removeArrow = () => {
        if (!arrow) return;
        window.clearInterval(arrow.rotateId);
        intervalsRef.current.delete(arrow.rotateId);
        window.clearTimeout(arrow.despawnId);
        timeoutsRef.current.delete(arrow.despawnId);
        world.removeChild(arrow.gfx);
        arrow.gfx.destroy();
        arrow = null;
      };

      const spawnArrow = () => {
        if (gameOverRef.current) return;
        if (pausedRef.current || !startedRef.current) { setT(spawnArrow, 800); return; }
        if (arrow) removeArrow();
        const gx = Math.floor(Math.random() * 8);
        const gy = Math.floor(Math.random() * 8);
        const p = isoPos(gx, gy);
        const gfx = new Graphics();
        // Arrow pointing UP (towards -y) so rotation 0 = UP
        gfx.poly([0, -22, 14, 0, 6, 0, 6, 22, -6, 22, -6, 0, -14, 0]).fill(0xffffff).stroke({ width: 2, color: 0x222222 });
        gfx.circle(0, 0, 26).stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
        gfx.x = p.x;
        gfx.y = p.y;
        gfx.zIndex = gx + gy + 0.1;
        // Map dir → screen vector along iso grid axes
        const dirVec = (d: number): [number, number] => {
          // 0=UP(gy-1), 1=RIGHT(gx+1), 2=DOWN(gy+1), 3=LEFT(gx-1)
          if (d === 0) return [-TILE_W / 2, -TILE_H / 2];
          if (d === 1) return [ TILE_W / 2, -TILE_H / 2];
          if (d === 2) return [ TILE_W / 2,  TILE_H / 2];
          return [-TILE_W / 2,  TILE_H / 2];
        };
        const isoRotation = (d: number) => {
          const [vx, vy] = dirVec(d);
          // Arrow art points to (0,-1) at rotation 0
          return Math.atan2(vx, -vy);
        };
        gfx.rotation = isoRotation(0);
        world.addChild(gfx);

        const rotateId = window.setInterval(() => {
          if (!arrow) return;
          arrow.dir = (arrow.dir + 1) % 4;
          arrow.gfx.rotation = isoRotation(arrow.dir);
        }, 2000);
        intervalsRef.current.add(rotateId);

        const despawnId = window.setTimeout(() => {
          timeoutsRef.current.delete(despawnId);
          if (gameOverRef.current || destroyed) return;
          removeArrow();
        }, 15000);
        timeoutsRef.current.add(despawnId);

        arrow = { gx, gy, dir: 0, gfx, rotateId, despawnId };

        // Schedule next arrow
        setT(spawnArrow, 20000);
      };

      const tryTriggerArrow = (c: Character) => {
        if (!arrow) return;
        if (c.gx !== arrow.gx || c.gy !== arrow.gy) return;
        const dir = arrow.dir;
        const dx = dir === 1 ? 1 : dir === 3 ? -1 : 0;
        const dy = dir === 0 ? -1 : dir === 2 ? 1 : 0;
        let x = c.gx + dx;
        let y = c.gy + dy;
        while (x >= 0 && x < 8 && y >= 0 && y < 8) {
          paintAt(x, y, c.skin);
          x += dx; y += dy;
        }
        // Also paint the arrow tile itself
        paintAt(c.gx, c.gy, c.skin);
        removeArrow();
      };

      // Initial paint
      land(player);
      for (const e of enemies) land(e);
      positionMinimap();
      updateMinimap();
      recomputeScores();

      // Defer game-loop spawns until user presses Start
      kickoffRef.current = () => {
        spawnChest();
        setT(spawnBomb, 5000 + Math.random() * 3000);
        setT(spawnBoots, 8000 + Math.random() * 4000);
        setT(spawnArrow, 15000);
      };
      if (startedRef.current) kickoffRef.current();

      const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

      const moveCharacter = (c: Character, direction: Direction) => {
        if (gameOverRef.current || !startedRef.current || pausedRef.current) return;
        if (c.anim) return;
        if (performance.now() < c.stunnedUntil) return;
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
        c.anim = { fromX, fromY, toX: nx, toY: ny, elapsed: 0, duration: jumpDurationFor(c) };
      };

      const movePlayer = (d: Direction) => moveCharacter(player, d);

      // Enemy AI: random walk every ~700ms
      const DIRS: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];
      let enemyTimer = 0;
      const ENEMY_INTERVAL = 700;

      app.ticker.add((ticker) => {
        const dtMs = ticker.deltaMS;
        const frozen = !startedRef.current || pausedRef.current || gameOverRef.current;

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

        // Animate characters (frozen when not running)
        let landedAny = false;
        if (!frozen) {
        for (const c of [player, ...enemies]) {
          if (!c.anim) continue;
          c.anim.elapsed += dtMs;
          const linear = Math.min(1, c.anim.elapsed / c.anim.duration);
          const t = ease(linear);
          const gx = c.anim.fromX + (c.anim.toX - c.anim.fromX) * t;
          const gy = c.anim.fromY + (c.anim.toY - c.anim.fromY) * t;
          const jumpOffset = Math.sin(linear * Math.PI) * -55;
          const shadowScale = 1 - Math.sin(linear * Math.PI) * 0.5;
          renderCharacterAt(c, gx, gy, jumpOffset, shadowScale);
          if (linear >= 1) {
            c.anim = null;
            land(c);
            tryCollectChest(c);
            tryCollectBoots(c);
            tryTriggerArrow(c);
            landedAny = true;
          }
        }
        if (landedAny) {
          updateMinimap();
          recomputeScores();
        }

        // Update auras for boost
        const nowMs = performance.now();
        for (const c of [player, ...enemies]) {
          const active = nowMs < c.boostUntil;
          c.aura.visible = active;
          if (active) {
            c.aura.x = c.sprite.x;
            c.aura.y = c.sprite.y - 30;
            c.aura.zIndex = c.sprite.zIndex - 0.01;
            c.aura.alpha = 0.6 + 0.3 * Math.sin(nowMs / 120);
          }
          if (nowMs < c.stunnedUntil) {
            c.sprite.x += Math.sin(nowMs / 30) * 2;
          }
        }

        // Enemy AI tick (per bot)
        enemyTimer += dtMs;
        if (enemyTimer >= ENEMY_INTERVAL) {
          enemyTimer = 0;
          for (const en of enemies) {
            if (en.anim) continue;
            if (performance.now() < en.stunnedUntil) continue;
            const valid = DIRS.filter((d) => {
              let nx = en.gx, ny = en.gy;
              if (d === "UP") ny--; else if (d === "DOWN") ny++;
              else if (d === "LEFT") nx--; else nx++;
              if (nx < 0 || nx > 7 || ny < 0 || ny > 7) return false;
              if (isWarningAt(nx, ny)) return false;
              return true;
            });
            const safe = valid.length ? valid : DIRS.filter((d) => {
              let nx = en.gx, ny = en.gy;
              if (d === "UP") ny--; else if (d === "DOWN") ny++;
              else if (d === "LEFT") nx--; else nx++;
              return nx >= 0 && nx < 8 && ny >= 0 && ny < 8;
            });
            if (!safe.length) continue;
            const distTo = (d: Direction, tx: number, ty: number) => {
              let nx = en.gx, ny = en.gy;
              if (d === "UP") ny--; else if (d === "DOWN") ny++;
              else if (d === "LEFT") nx--; else nx++;
              return Math.abs(nx - tx) + Math.abs(ny - ty);
            };
            const bootsDist = boots ? Math.abs(en.gx - boots.gx) + Math.abs(en.gy - boots.gy) : Infinity;
            const arrowDist = arrow ? Math.abs(en.gx - arrow.gx) + Math.abs(en.gy - arrow.gy) : Infinity;
            const ownedN = countOwned(en.skin.id);
            let chosen: Direction;
            if (arrow && arrowDist <= 2) {
              chosen = safe.reduce((best, d) =>
                distTo(d, arrow!.gx, arrow!.gy) < distTo(best, arrow!.gx, arrow!.gy) ? d : best, safe[0]);
            } else if (boots && bootsDist <= 2) {
              chosen = safe.reduce((best, d) =>
                distTo(d, boots!.gx, boots!.gy) < distTo(best, boots!.gx, boots!.gy) ? d : best, safe[0]);
            } else if (ownedN > 3) {
              chosen = safe.reduce((best, d) =>
                distTo(d, chest.gx, chest.gy) < distTo(best, chest.gx, chest.gy) ? d : best, safe[0]);
            } else {
              chosen = safe[Math.floor(Math.random() * safe.length)];
            }
            moveCharacter(en, chosen);
          }
        }
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
        if (gameOverRef.current || !startedRef.current || pausedRef.current) return;
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
      if (scheduledTimeouts) {
        for (const id of scheduledTimeouts) window.clearTimeout(id);
        scheduledTimeouts.clear();
      }
      if (scheduledIntervals) {
        for (const id of scheduledIntervals) window.clearInterval(id);
        scheduledIntervals.clear();
      }
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
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const urgent = timeLeft <= 10 && timeLeft > 0;
  const winner: SkinId = activeSkins.reduce((best, id) =>
    banked[id] > banked[best] ? id : best, activeSkins[0]);
  const topScore = banked[winner];
  const isTie = activeSkins.filter((id) => banked[id] === topScore).length > 1;

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
        className="fixed left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-full bg-black/55 px-4 py-2 backdrop-blur-sm text-sm font-bold text-white shadow-lg"
        style={{ touchAction: "none", top: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
      >
        {activeSkins.map((id, i) => {
          const sk = SKINS[id];
          return (
            <span key={id} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-white/40">·</span>}
              <span className="inline-block h-3 w-3 rounded-full ring-2 ring-white/30" style={{ background: sk.uiColor }} />
              <span className="tabular-nums" style={{ color: sk.uiColor }}>{banked[id]}</span>
              <span className="text-white/60 tabular-nums text-xs">+{scores[id]}</span>
            </span>
          );
        })}
      </div>

      {/* Timer */}
      <div
        className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/55 px-4 py-1 backdrop-blur-sm shadow-lg"
        style={{ touchAction: "none", top: "calc(env(safe-area-inset-top, 0px) + 110px)" }}
      >
        <span
          className="font-mono text-2xl font-extrabold tabular-nums tracking-wider"
          style={{
            color: urgent ? "#ff3b3b" : "#ffffff",
            textShadow: urgent ? "0 0 10px rgba(255,59,59,0.7)" : "none",
            animation: urgent ? "iso-pulse 0.8s ease-in-out infinite" : "none",
            display: "inline-block",
          }}
        >
          {mm}:{ss}
        </span>
        <style>{`@keyframes iso-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.85; } }`}</style>
      </div>

      {/* Game Over overlay */}
      {gameOver && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-2xl bg-zinc-900/95 px-8 py-7 text-center shadow-2xl ring-1 ring-white/10 min-w-[280px]">
            <div className="text-xs font-bold uppercase tracking-widest text-white/50">End of Round</div>
            <div className="mt-2 text-3xl font-extrabold text-white">
              {isTie ? "It's a Tie!" : (
                <span style={{ color: SKINS[winner].uiColor }}>
                  {SKINS[winner].name} wins!
                </span>
              )}
            </div>
            <div className="mt-5 space-y-2 text-left">
              {[PLAYER_SKIN, ENEMY_SKIN].map((id) => (
                <div key={id} className="flex items-center justify-between gap-6 rounded-lg bg-white/5 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: SKINS[id].uiColor }} />
                    <span className="font-bold" style={{ color: SKINS[id].uiColor }}>{SKINS[id].name}</span>
                  </span>
                  <span className="font-mono text-lg font-bold text-white tabular-nums">{banked[id]}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 w-full rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold uppercase tracking-wider text-black active:scale-95"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Pause / Settings gear (top-right) */}
      <button
        type="button"
        onClick={() => {
          if (!started) return;
          setPaused((p) => !p);
        }}
        disabled={!started || gameOver}
        className="fixed right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm shadow-lg active:scale-95 disabled:opacity-40"
        style={{ touchAction: "none", top: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
        aria-label={paused ? "Resume" : "Pause"}
      >
        <Settings size={20} />
      </button>

      {/* Start overlay */}
      {!started && !gameOver && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl bg-zinc-900/95 px-8 py-7 text-center shadow-2xl ring-1 ring-white/10 min-w-[260px]">
            <div className="text-xs font-bold uppercase tracking-widest text-white/50">Get Ready</div>
            <div className="mt-2 text-2xl font-extrabold text-white">Paint the Grid!</div>
            <p className="mt-3 text-sm text-white/70">Tap & drag to move. Bank tiles at the chest. 90s round.</p>
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-sm font-bold uppercase tracking-wider text-black active:scale-95"
            >
              <Play size={16} fill="currentColor" /> Start Round
            </button>
          </div>
        </div>
      )}

      {/* Pause overlay */}
      {paused && started && !gameOver && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl bg-zinc-900/95 px-8 py-7 text-center shadow-2xl ring-1 ring-white/10 min-w-[240px]">
            <div className="text-xs font-bold uppercase tracking-widest text-white/50">Paused</div>
            <div className="mt-2 text-2xl font-extrabold text-white">Take a breath</div>
            <button
              type="button"
              onClick={() => setPaused(false)}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-sm font-bold uppercase tracking-wider text-black active:scale-95"
            >
              <Play size={16} fill="currentColor" /> Resume
            </button>
          </div>
        </div>
      )}

      <div
        className="fixed left-4 z-50 flex items-center gap-2 rounded-full bg-black/40 px-2 py-2 backdrop-blur-sm"
        style={{ touchAction: "none", bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <button
          type="button"
          onClick={() => setZoomOpen((o) => !o)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-sm font-bold text-black active:scale-95"
          aria-label={zoomOpen ? "Collapse zoom" : "Expand zoom"}
          aria-expanded={zoomOpen}
        >
          {zoomOpen ? "×" : "⌕"}
        </button>
        {zoomOpen && (
          <>
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
          </>
        )}
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
