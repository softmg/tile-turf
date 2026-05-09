import { useEffect, useRef, useState } from "react";
import { Settings, Play } from "lucide-react";
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture, FederatedPointerEvent } from "pixi.js";
import chestUrl from "@/assets/chest.webp";
import bomb1Url from "@/assets/bomb/bomb1.webp";
import bomb2Url from "@/assets/bomb/bomb2.webp";
import bomb3Url from "@/assets/bomb/bomb3.webp";
import bomb4Url from "@/assets/bomb/bomb4.webp";
import bootsUrl from "@/assets/boots.webp";
import {
  BACKGROUND_URL,
  BASE_JUMP_DURATION,
  BOARD_SIZE,
  BOOST_DURATION,
  BOOST_JUMP_DURATION,
  BOT_SKINS,
  DIRECTIONS,
  ENEMY_SPAWN_POSITIONS,
  MAX_LEVEL,
  PAINTED_TILE_URL,
  PLAYER_SKIN,
  PLAYER_URL,
  SKINS,
  SKIN_IDS,
  STUN_DURATION,
  TILE_SIZE,
  UNPAINTED_MINIMAP_COLOR,
  UNPAINTED_TILE_URL,
  WINS_TO_PASS,
  botsForLevel,
  enemyIntervalForLevel,
  roundDurationForLevel,
  type Direction,
  type RoundHistoryEntry,
  type SkinConfig,
  type SkinId,
  zeroScores,
} from "@/game/game-constants";
import { isoPos, isInsideBoard, manhattanDistance, nextGridPosition } from "@/game/grid-math";
import { countOwned as countOwnedTiles, scoreOwners, scoresChanged, type OwnerGrid } from "@/game/scoring";
import { createSeededRng, seedFromParts } from "@/game/rng";
import { markTutorialSeen, readUnlockedLevel, shouldShowTutorial, writeUnlockedLevel } from "@/game/level-state";
import type { Character } from "@/game/entities";
import { hazardSpriteScale, isoRotation, type ArrowState, type Bomb } from "@/game/hazards";

type InertProps = { "aria-hidden"?: true; inert?: boolean };

const inertBackgroundProps = (isInert: boolean): InertProps =>
  isInert ? { "aria-hidden": true, inert: true } : {};

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => string;
  }
}

interface IsoRoundProps {
  level: number;
  roundIndex: number;
  matchWins: Record<SkinId, number>;
  history: RoundHistoryEntry[];
  onRoundEnd: (winner: SkinId | null, banked: Record<SkinId, number>) => void;
}

function IsoRound({ level, roundIndex, matchWins, history, onRoundEnd }: IsoRoundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [debug, setDebug] = useState(false);
  const canShowDebug = import.meta.env.DEV;
  const debugRef = useRef(false);
  const [stats, setStats] = useState({
    fps: 0, frameMs: 0, maxMs: 0,
    paints: 0, miniCells: 0, miniPasses: 0,
    anims: 0, bombs: 0, enemies: 0,
  });
  const statsAccum = useRef({
    frames: 0, sumMs: 0, maxMs: 0, lastFlush: 0,
    paints: 0, miniCells: 0, miniPasses: 0,
    animSum: 0, animSamples: 0, bombsMax: 0, enemiesActive: 0,
  });
  const [scores, setScores] = useState<Record<SkinId, number>>(() => zeroScores());
  const [banked, setBanked] = useState<Record<SkinId, number>>(() => zeroScores());
  const roundDuration = roundDurationForLevel(level);
  const [timeLeft, setTimeLeft] = useState(roundDuration);
  const [gameOver, setGameOver] = useState(false);
  const gameOverRef = useRef(false);
  const [started, setStarted] = useState(true);
  const startedRef = useRef(true);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const kickoffRef = useRef<(() => void) | null>(null);
  const botCount = botsForLevel(level);
  const botCountRef = useRef(botCount);
  const levelRef = useRef(level);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  useEffect(() => { botCountRef.current = botCount; levelRef.current = level; }, [botCount, level]);
  const activeBotSkins: SkinId[] = BOT_SKINS.slice(0, botCount);
  const activeSkins: SkinId[] = [PLAYER_SKIN, ...activeBotSkins];
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
  }, [gameOver]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const app = new Application();
    let destroyed = false;
    let keyHandler: ((e: KeyboardEvent) => void) | null = null;
    let resizeHandler: (() => void) | null = null;
    let removeWindowErrorHandlers: (() => void) | null = null;

    (async () => {
      try {
        // Detect coarse-pointer / mobile to lower resolution and disable AA.
        const isCoarse = typeof window.matchMedia === "function"
          && window.matchMedia("(pointer: coarse)").matches;
        const dpr = window.devicePixelRatio || 1;
        // High-DPR mobile devices (e.g. iPhone Pro at DPR 3) ate 9× pixels.
        // Cap aggressively on mobile; cap at 2 on desktop.
        const resolution = isCoarse ? Math.min(dpr, 1.5) : Math.min(dpr, 2);
        await app.init({
          resizeTo: window,
          backgroundAlpha: 0,
          antialias: !isCoarse,
          resolution,
          autoDensity: true,
          preference: "webgl",
          powerPreference: "high-performance",
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
      const onWindowError = (e: ErrorEvent) => console.error("[IsoGrid] window error", e.error || e.message);
      const onUnhandledRejection = (e: PromiseRejectionEvent) =>
        console.error("[IsoGrid] unhandled rejection", e.reason);
      window.addEventListener("error", onWindowError);
      window.addEventListener("unhandledrejection", onUnhandledRejection);
      removeWindowErrorHandlers = () => {
        window.removeEventListener("error", onWindowError);
        window.removeEventListener("unhandledrejection", onUnhandledRejection);
      };




      // Load uploaded local PNG assets via Pixi's Assets pipeline.
      // Local Vite-served files have proper extensions and no CORS issues.
      
      const [unpaintedTex, paintedTex, playerTex, chestTex, bombTex1, bombTex2, bombTex3, boomTex, bootsTex] =
        await Promise.all([
          Assets.load<Texture>(UNPAINTED_TILE_URL),
          Assets.load<Texture>(PAINTED_TILE_URL),
          Assets.load<Texture>(PLAYER_URL),
          Assets.load<Texture>(chestUrl),
          Assets.load<Texture>(bomb1Url),
          Assets.load<Texture>(bomb2Url),
          Assets.load<Texture>(bomb3Url),
          Assets.load<Texture>(bomb4Url),
          Assets.load<Texture>(bootsUrl),
        ]);
      if (destroyed) return;
      for (const t of [unpaintedTex, paintedTex, playerTex, chestTex, bombTex1, bombTex2, bombTex3, boomTex, bootsTex]) {
        if (t?.source) {
          t.source.scaleMode = "linear";
          t.source.autoGenerateMipmaps = true;
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

      // Tile ownership: null = unpainted, else SkinId
      const owners: OwnerGrid = [];
      const tiles: Sprite[][] = [];
      for (let x = 0; x < BOARD_SIZE; x++) {
        tiles[x] = [];
        owners[x] = [];
        for (let y = 0; y < BOARD_SIZE; y++) {
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
      const allEnemies: Character[] = BOT_SKINS.map((sid, i) =>
        makeCharacter(sid, ENEMY_SPAWN_POSITIONS[i][0], ENEMY_SPAWN_POSITIONS[i][1])
      );
      const enemies: Character[] = []; // active enemies; populated in kickoff
      // Hide all bot sprites until activated
      for (const e of allEnemies) {
        e.sprite.visible = false;
        e.shadow.visible = false;
      }

      let gameTimeMs = 0;
      const gameNow = () => gameTimeMs;
      let lastCountdownValue = roundDuration;
      const updateCountdown = () => {
        const next = Math.max(0, roundDuration - Math.floor(gameNow() / 1000));
        if (next === lastCountdownValue) return;
        lastCountdownValue = next;
        setTimeLeft(next);
        if (next <= 0) {
          gameOverRef.current = true;
          setGameOver(true);
        }
      };
      const jumpDurationFor = (c: Character) =>
        gameNow() < c.boostUntil ? BOOST_JUMP_DURATION : BASE_JUMP_DURATION;


      // ---------- Minimap ----------
      const MINI_CELL = 10;
      const MINI_SIZE = BOARD_SIZE * MINI_CELL;
      const minimap = new Container();
      minimap.zIndex = 999;
      app.stage.addChild(minimap);

      const miniBg = new Graphics();
      miniBg.rect(-4, -4, MINI_SIZE + 8, MINI_SIZE + 8).fill({ color: 0x000000, alpha: 0.5 });
      minimap.addChild(miniBg);

      const miniTiles: Graphics[][] = [];
      for (let x = 0; x < BOARD_SIZE; x++) {
        miniTiles[x] = [];
        for (let y = 0; y < BOARD_SIZE; y++) {
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

      // Pre-create one minimap marker per possible bot; toggle visibility on kickoff
      const allMiniEnemies: Graphics[] = allEnemies.map((e) => {
        const g = new Graphics();
        g.circle(0, 0, 3).stroke({ width: 1.5, color: 0xffffff }).fill(SKINS[e.skin.id].minimapColor);
        g.zIndex = 10;
        g.visible = false;
        minimap.addChild(g);
        return g;
      });
      const miniEnemies: Graphics[] = []; // synced in kickoff

      // Item / hazard markers
      const miniChest = new Graphics();
      miniChest.zIndex = 9;
      miniChest.visible = false;
      minimap.addChild(miniChest);

      const miniArrow = new Graphics();
      miniArrow.zIndex = 9;
      miniArrow.visible = false;
      minimap.addChild(miniArrow);

      const miniBombs = new Graphics();
      miniBombs.zIndex = 9;
      minimap.addChild(miniBombs);

      const positionMinimap = () => {
        minimap.x = app.screen.width - MINI_SIZE - 16;
        minimap.y = app.screen.height - MINI_SIZE - 16;
      };

      const miniTileColor: number[][] = [];
      for (let x = 0; x < BOARD_SIZE; x++) {
        miniTileColor[x] = [];
        for (let y = 0; y < BOARD_SIZE; y++) miniTileColor[x][y] = UNPAINTED_MINIMAP_COLOR;
      }
      let minimapTilesDirty = true;

      const updateMinimapTiles = () => {
        if (!minimapTilesDirty) return;
        minimapTilesDirty = false;
        statsAccum.current.miniPasses += 1;
        for (let x = 0; x < BOARD_SIZE; x++) {
          for (let y = 0; y < BOARD_SIZE; y++) {
            const o = owners[x][y];
            const color = o ? SKINS[o].minimapColor : UNPAINTED_MINIMAP_COLOR;
            if (miniTileColor[x][y] === color) continue;
            miniTileColor[x][y] = color;
            const m = miniTiles[x][y];
            m.clear();
            m.rect(x * MINI_CELL, y * MINI_CELL, MINI_CELL - 1, MINI_CELL - 1).fill(color);
            statsAccum.current.miniCells += 1;
          }
        }
      };

      const updateMinimapMarkers = () => {
        miniPlayer.x = player.gx * MINI_CELL + MINI_CELL / 2;
        miniPlayer.y = player.gy * MINI_CELL + MINI_CELL / 2;
        for (let i = 0; i < enemies.length; i++) {
          miniEnemies[i].x = enemies[i].gx * MINI_CELL + MINI_CELL / 2;
          miniEnemies[i].y = enemies[i].gy * MINI_CELL + MINI_CELL / 2;
        }

        const cx = chest.gx * MINI_CELL + MINI_CELL / 2;
        const cy = chest.gy * MINI_CELL + MINI_CELL / 2;
        miniChest.clear();
        miniChest.rect(cx - 3, cy - 3, 6, 6).fill(0xffd24a).stroke({ width: 1, color: 0x6a4500 });
        miniChest.visible = true;

        miniArrow.clear();
        if (arrow) {
          const ax = arrow.gx * MINI_CELL + MINI_CELL / 2;
          const ay = arrow.gy * MINI_CELL + MINI_CELL / 2;
          const tri =
            arrow.dir === 0 ? [0, -4, 3, 2, -3, 2] :
            arrow.dir === 1 ? [4, 0, -2, 3, -2, -3] :
            arrow.dir === 2 ? [0, 4, -3, -2, 3, -2] :
                              [-4, 0, 2, -3, 2, 3];
          miniArrow.poly(tri.map((v, i) => v + (i % 2 === 0 ? ax : ay)))
            .fill(0xffffff).stroke({ width: 1, color: 0x222222 });
          miniArrow.visible = true;
        } else {
          miniArrow.visible = false;
        }

        miniBombs.clear();
        for (const b of bombs) {
          const bx = b.gx * MINI_CELL + MINI_CELL / 2;
          const by = b.gy * MINI_CELL + MINI_CELL / 2;
          const color = b.phase === "explosion" ? 0xfff2a0 : 0xff2222;
          miniBombs.circle(bx, by, 2.5).fill(color).stroke({ width: 1, color: 0x000000 });
        }
      };

      const updateMinimap = () => {
        updateMinimapTiles();
        updateMinimapMarkers();
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
        if (!cameraInitialized) {
          // Fit grid to screen on first render
          const minX = isoPos(0, 7).x;
          const maxX = isoPos(7, 0).x;
          const minY = isoPos(0, 0).y;
          const maxY = isoPos(7, 7).y;
          const rawW = maxX - minX + TILE_SIZE;
          const rawH = maxY - minY + TILE_SIZE;
          // Reserve some space for HUD/scoreboard (top + bottom)
          const padX = 24;
          const padY = 140;
          const availW = Math.max(100, app.screen.width - padX * 2);
          const availH = Math.max(100, app.screen.height - padY);
          const fit = Math.min(availW / rawW, availH / rawH);
          const fitZoom = Math.max(0.3, Math.min(2, fit));
          zoomRef.current = fitZoom;
          setZoom(fitZoom);
        }
        computeCameraTarget();
        if (!cameraInitialized) {
          world.scale.set(zoomRef.current);
          world.x = cameraTargetX;
          world.y = cameraTargetY;
          cameraInitialized = true;
        }
      };

      const paintAt = (gx: number, gy: number, skin: SkinConfig) => {
        if (owners[gx][gy] === skin.id) return;
        owners[gx][gy] = skin.id;
        const tile = tiles[gx][gy];
        tile.texture = skinTextures[skin.id].tile;
        tile.tint = skin.spriteTint;
        minimapTilesDirty = true;
        statsAccum.current.paints += 1;
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

      const rng = createSeededRng(seedFromParts("tile-turf", level, roundIndex));
      const randomCell = () => ({ gx: rng.int(BOARD_SIZE), gy: rng.int(BOARD_SIZE) });
      const randomUnoccupiedCell = () => {
        let cell = randomCell();
        for (let i = 0; i < 50; i++) {
          cell = randomCell();
          const occupiedByPlayer = player.gx === cell.gx && player.gy === cell.gy;
          const occupiedByEnemy = enemies.some((c) => c.gx === cell.gx && c.gy === cell.gy);
          if (!occupiedByPlayer && !occupiedByEnemy) break;
        }
        return cell;
      };

      interface GameTimer {
        due: number;
        fn: () => void;
        cancelled: boolean;
      }
      const gameTimers: GameTimer[] = [];
      const scheduleGame = (fn: () => void, ms: number) => {
        const timer = { due: gameNow() + ms, fn, cancelled: false };
        gameTimers.push(timer);
        return timer;
      };
      const flushGameTimers = () => {
        for (let i = 0; i < gameTimers.length;) {
          const timer = gameTimers[i];
          if (timer.cancelled) {
            gameTimers.splice(i, 1);
            continue;
          }
          if (timer.due > gameNow()) {
            i++;
            continue;
          }
          gameTimers.splice(i, 1);
          timer.fn();
        }
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
        const { gx, gy } = randomUnoccupiedCell();
        chest.gx = gx;
        chest.gy = gy;
        const p = isoPos(gx, gy);
        chestSprite.x = p.x;
        chestSprite.y = p.y + 14;
        chestSprite.zIndex = gx + gy + 0.05;
      };

      const lastScores: Record<SkinId, number> = zeroScores();
      let scoresDirty = false;
      let lastScoresFlush = 0;
      const recomputeScores = () => {
        const next = scoreOwners(owners);
        if (scoresChanged(lastScores, next)) {
          for (const id of SKIN_IDS) lastScores[id] = next[id];
          scoresDirty = true;
        }
        return next;
      };

      const countOwned = (skinId: SkinId) => countOwnedTiles(owners, skinId);

      const clearOwnedBy = (skinId: SkinId) => {
        let any = false;
        for (let x = 0; x < BOARD_SIZE; x++) for (let y = 0; y < BOARD_SIZE; y++) {
          if (owners[x][y] === skinId) {
            owners[x][y] = null;
            const t = tiles[x][y];
            t.texture = unpaintedTex;
            t.tint = 0xffffff;
            any = true;
          }
        }
        if (any) minimapTilesDirty = true;
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
      const bombs: Bomb[] = [];
      const isWarningAt = (gx: number, gy: number) =>
        bombs.some((b) => b.phase === "warning" && b.gx === gx && b.gy === gy);

      const BOMB_TARGET_H = 90;
      const BOOM_TARGET_H = 140;

      const removeBomb = (bomb: Bomb) => {
        if (bomb.warning.parent) world.removeChild(bomb.warning);
        bomb.warning.destroy();
        if (bomb.boom) {
          if (bomb.boom.parent) world.removeChild(bomb.boom);
          bomb.boom.destroy();
        }
        const i = bombs.indexOf(bomb);
        if (i >= 0) bombs.splice(i, 1);
      };

      const explodeBomb = (bomb: Bomb) => {
        if (gameOverRef.current || destroyed || bomb.phase !== "warning") return;
        if (bomb.warning.parent) world.removeChild(bomb.warning);
        bomb.warning.destroy();
        bomb.phase = "explosion";
        bomb.explosionElapsed = 0;

        const p = isoPos(bomb.gx, bomb.gy);
        const boom = new Sprite(boomTex);
        boom.anchor.set(0.5, 0.5);
        boom.scale.set(hazardSpriteScale(boomTex, BOOM_TARGET_H));
        boom.x = p.x;
        boom.y = p.y;
        boom.zIndex = bomb.gx + bomb.gy + 0.5;
        world.addChild(boom);
        bomb.boom = boom;

        for (const c of [player, ...enemies]) {
          if (c.gx === bomb.gx && c.gy === bomb.gy && !c.anim) {
            c.stunnedUntil = gameNow() + STUN_DURATION;
            clearOwnedBy(c.skin.id);
            recomputeScores();
            updateMinimap();
          }
        }
      };

      const spawnBomb = () => {
        if (gameOverRef.current || destroyed || !startedRef.current) return;
        const { gx, gy } = randomCell();
        const p = isoPos(gx, gy);

        const warning = new Sprite(bombTex1);
        warning.anchor.set(0.5, 0.5);
        warning.scale.set(hazardSpriteScale(bombTex1, BOMB_TARGET_H));
        warning.x = p.x;
        warning.y = p.y;
        warning.zIndex = gx + gy + 0.06;
        world.addChild(warning);
        const bomb: Bomb = {
          gx,
          gy,
          warning,
          boom: null,
          phase: "warning",
          warningElapsed: 0,
          explosionElapsed: 0,
        };
        bombs.push(bomb);

        scheduleGame(() => explodeBomb(bomb), 2000);
        scheduleGame(spawnBomb, rng.range(5000, 8000));
      };

      const updateBombs = (dtMs: number) => {
        for (let i = bombs.length - 1; i >= 0; i--) {
          const bomb = bombs[i];
          if (bomb.phase === "warning") {
            bomb.warningElapsed += dtMs;
            const elapsed = bomb.warningElapsed;
            let tex = bombTex1;
            if (elapsed > 1400) tex = bombTex3;
            else if (elapsed > 600) tex = bombTex2;
            if (bomb.warning.texture !== tex) {
              bomb.warning.texture = tex;
              bomb.warning.scale.set(hazardSpriteScale(tex, BOMB_TARGET_H));
            }
            const p = isoPos(bomb.gx, bomb.gy);
            if (elapsed > 1400) {
              const k = (elapsed - 1400) / 600;
              const amp = 1 + k * 3;
              bomb.warning.x = p.x + Math.sin((elapsed + bomb.gx * 17 + bomb.gy * 31) / 28) * amp;
            } else {
              bomb.warning.x = p.x;
            }
            continue;
          }

          if (!bomb.boom) continue;
          bomb.explosionElapsed += dtMs;
          const k = Math.min(1, bomb.explosionElapsed / 220);
          const s = hazardSpriteScale(boomTex, BOOM_TARGET_H) * (0.4 + 0.6 * k);
          bomb.boom.scale.set(s);
          bomb.boom.alpha = Math.max(0, 1 - Math.max(0, bomb.explosionElapsed - 280) / 220);
          if (bomb.explosionElapsed >= 500) removeBomb(bomb);
        }
      };

      let boots: { gx: number; gy: number; gfx: Sprite } | null = null;
      const spawnBoots = () => {
        if (gameOverRef.current || destroyed || !startedRef.current || boots) return;
        const { gx, gy } = randomCell();
        const p = isoPos(gx, gy);
        const gfx = new Sprite(bootsTex);
        gfx.anchor.set(0.5, 0.5);
        const targetH = 70;
        const s = targetH / Math.max(bootsTex.height, 1);
        gfx.scale.set(s);
        gfx.x = p.x;
        gfx.y = p.y;
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
        c.boostUntil = gameNow() + BOOST_DURATION;
        scheduleGame(spawnBoots, rng.range(10000, 15000));
      };

      // ---------- Rotating Arrow ----------
      // dir: 0=UP, 1=RIGHT, 2=DOWN, 3=LEFT
      let arrow: ArrowState | null = null;

      const removeArrow = () => {
        if (!arrow) return;
        world.removeChild(arrow.gfx);
        arrow.gfx.destroy();
        arrow = null;
      };

      const spawnArrow = () => {
        if (gameOverRef.current || destroyed || !startedRef.current) return;
        if (arrow) removeArrow();
        const { gx, gy } = randomCell();
        const p = isoPos(gx, gy);
        const gfx = new Graphics();
        gfx.poly([0, -22, 14, 0, 6, 0, 6, 22, -6, 22, -6, 0, -14, 0]).fill(0xffffff).stroke({ width: 2, color: 0x222222 });
        gfx.circle(0, 0, 26).stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
        gfx.x = p.x;
        gfx.y = p.y;
        gfx.zIndex = gx + gy + 0.1;
        gfx.rotation = isoRotation(0);
        world.addChild(gfx);

        arrow = { gx, gy, dir: 0, gfx, rotateElapsed: 0, lifeElapsed: 0 };
        scheduleGame(spawnArrow, 20000);
      };

      const updateArrow = (dtMs: number) => {
        if (!arrow) return;
        arrow.rotateElapsed += dtMs;
        arrow.lifeElapsed += dtMs;
        while (arrow && arrow.rotateElapsed >= 2000) {
          arrow.rotateElapsed -= 2000;
          arrow.dir = (arrow.dir + 1) % 4;
          arrow.gfx.rotation = isoRotation(arrow.dir);
        }
        if (arrow && arrow.lifeElapsed >= 15000) removeArrow();
      };

      const tryTriggerArrow = (c: Character, snapshotDir: number | null) => {
        if (!arrow) return;
        if (c.gx !== arrow.gx || c.gy !== arrow.gy) return;
        const dir = snapshotDir ?? arrow.dir;
        const dx = dir === 1 ? 1 : dir === 3 ? -1 : 0;
        const dy = dir === 0 ? -1 : dir === 2 ? 1 : 0;
        paintAt(c.gx, c.gy, c.skin);
        let x = c.gx + dx;
        let y = c.gy + dy;
        while (isInsideBoard(x, y)) {
          paintAt(x, y, c.skin);
          x += dx;
          y += dy;
        }
        removeArrow();
      };

      // Initial paint (player only; bots activated on kickoff)
      land(player);
      positionMinimap();
      updateMinimap();
      recomputeScores();

      // Defer game-loop spawns + bot activation until user presses Start
      kickoffRef.current = () => {
        const n = Math.min(botCountRef.current, allEnemies.length);
        enemies.length = 0;
        miniEnemies.length = 0;
        for (let i = 0; i < allEnemies.length; i++) {
          const active = i < n;
          allEnemies[i].sprite.visible = active;
          allEnemies[i].shadow.visible = active;
          allMiniEnemies[i].visible = active;
          if (active) {
            enemies.push(allEnemies[i]);
            miniEnemies.push(allMiniEnemies[i]);
            land(allEnemies[i]);
          }
        }
        updateMinimap();
        spawnChest();
        scheduleGame(spawnBomb, rng.range(5000, 8000));
        scheduleGame(spawnBoots, rng.range(8000, 12000));
        scheduleGame(spawnArrow, 15000);
      };
      if (startedRef.current) kickoffRef.current();

      const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

      const moveCharacter = (c: Character, direction: Direction) => {
        if (gameOverRef.current || !startedRef.current || pausedRef.current) return;
        if (c.anim) return;
        if (gameNow() < c.stunnedUntil) return;
        const next = nextGridPosition(c.gx, c.gy, direction);
        if (!isInsideBoard(next.gx, next.gy)) return;
        const fromX = c.gx;
        const fromY = c.gy;
        c.gx = next.gx;
        c.gy = next.gy;
        updateMinimap();
        const arrowDir = (arrow && arrow.gx === next.gx && arrow.gy === next.gy) ? arrow.dir : null;
        c.anim = { fromX, fromY, toX: next.gx, toY: next.gy, elapsed: 0, duration: jumpDurationFor(c), arrowDir };
      };

      const movePlayer = (d: Direction) => moveCharacter(player, d);

      const renderGameToText = () => {
        const rows: string[] = [];
        for (let y = 0; y < BOARD_SIZE; y++) {
          let row = "";
          for (let x = 0; x < BOARD_SIZE; x++) {
            let mark = owners[x][y]?.slice(0, 1).toUpperCase() ?? ".";
            if (chest.gx === x && chest.gy === y) mark = "C";
            if (arrow && arrow.gx === x && arrow.gy === y) mark = "A";
            if (bombs.some((b) => b.gx === x && b.gy === y)) mark = "B";
            const enemyIndex = enemies.findIndex((en) => en.gx === x && en.gy === y);
            if (enemyIndex >= 0) mark = String(enemyIndex + 1);
            if (player.gx === x && player.gy === y) mark = "P";
            row += mark;
          }
          rows.push(row);
        }
        return [
          `level=${levelRef.current}`,
          `time=${Math.round(gameNow())}`,
          `paused=${pausedRef.current}`,
          ...rows,
        ].join("\n");
      };

      const advanceTime = (ms: number) => {
        if (destroyed || gameOverRef.current || pausedRef.current || !startedRef.current) return renderGameToText();
        let remaining = Math.max(0, Math.min(ms, 60000));
        while (remaining > 0) {
          const dt = Math.min(50, remaining);
          gameTimeMs += dt;
          updateCountdown();
          flushGameTimers();
          updateBombs(dt);
          updateArrow(dt);
          remaining -= dt;
        }
        updateMinimap();
        return renderGameToText();
      };

      window.render_game_to_text = renderGameToText;
      window.advanceTime = advanceTime;

      // Enemy AI: random walk every ~700ms
      let enemyTimer = 0;
      const enemyInterval = () => enemyIntervalForLevel(levelRef.current);

      app.ticker.add((ticker) => {
        const dtMs = ticker.deltaMS;
        const frozen = !startedRef.current || pausedRef.current || gameOverRef.current;

        if (debugRef.current) {
          const s = statsAccum.current;
          s.frames += 1;
          s.sumMs += dtMs;
          if (dtMs > s.maxMs) s.maxMs = dtMs;
          // Sample active animations & bombs each frame
          let animCount = 0;
          if (player.anim) animCount += 1;
          let enemiesActive = 0;
          for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].anim) animCount += 1;
            enemiesActive += 1;
          }
          s.animSum += animCount;
          s.animSamples += 1;
          if (bombs.length > s.bombsMax) s.bombsMax = bombs.length;
          s.enemiesActive = enemiesActive;
          const now = performance.now();
          if (s.lastFlush === 0) s.lastFlush = now;
          if (now - s.lastFlush >= 200) {
            const avg = s.sumMs / Math.max(1, s.frames);
            const winSec = (now - s.lastFlush) / 1000;
            setStats({
              fps: Math.round(1000 / Math.max(0.001, avg)),
              frameMs: +avg.toFixed(2),
              maxMs: +s.maxMs.toFixed(2),
              paints: Math.round(s.paints / Math.max(0.001, winSec)),
              miniCells: Math.round(s.miniCells / Math.max(0.001, winSec)),
              miniPasses: Math.round(s.miniPasses / Math.max(0.001, winSec)),
              anims: +(s.animSum / Math.max(1, s.animSamples)).toFixed(1),
              bombs: s.bombsMax,
              enemies: enemiesActive,
            });
            s.frames = 0; s.sumMs = 0; s.maxMs = 0; s.lastFlush = now;
            s.paints = 0; s.miniCells = 0; s.miniPasses = 0;
            s.animSum = 0; s.animSamples = 0; s.bombsMax = 0;
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
        gameTimeMs += dtMs;
        updateCountdown();
        flushGameTimers();
        updateBombs(dtMs);
        updateArrow(dtMs);

        // Iterate stable list (player + active enemies) without per-frame allocation
        for (let ci = -1; ci < enemies.length; ci++) {
          const c = ci < 0 ? player : enemies[ci];
          if (!c.anim) continue;
          c.anim.elapsed += dtMs;
          const linear = Math.min(1, c.anim.elapsed / c.anim.duration);
          const t = ease(linear);
          const gx = c.anim.fromX + (c.anim.toX - c.anim.fromX) * t;
          const gy = c.anim.fromY + (c.anim.toY - c.anim.fromY) * t;
          const arc = Math.sin(linear * Math.PI);
          const jumpOffset = arc * -55;
          const shadowScale = 1 - arc * 0.5;
          renderCharacterAt(c, gx, gy, jumpOffset, shadowScale);
          if (linear >= 1) {
            const arrowDir = c.anim.arrowDir;
            c.anim = null;
            land(c);
            tryCollectChest(c);
            tryCollectBoots(c);
            tryTriggerArrow(c, arrowDir);
            landedAny = true;
          }
        }
        if (landedAny) {
          recomputeScores();
          updateMinimapTiles();
        }
        // Cheap per-frame: marker positions only (tiles updated on dirty)
        updateMinimapMarkers();

        // Throttle React score updates to ~5Hz to avoid HUD re-render storms
        if (scoresDirty) {
          const nowS = gameNow();
          if (nowS - lastScoresFlush > 200) {
            lastScoresFlush = nowS;
            scoresDirty = false;
            setScores({ ...lastScores });
          }
        }

        // Update auras for boost
        const nowMs = gameNow();
        for (let ci = -1; ci < enemies.length; ci++) {
          const c = ci < 0 ? player : enemies[ci];
          const active = nowMs < c.boostUntil;
          if (c.aura.visible !== active) c.aura.visible = active;
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
        if (enemyTimer >= enemyInterval()) {
          enemyTimer = 0;
          for (const en of enemies) {
            if (en.anim) continue;
            if (gameNow() < en.stunnedUntil) continue;
            const valid = DIRECTIONS.filter((d) => {
              const next = nextGridPosition(en.gx, en.gy, d);
              if (!isInsideBoard(next.gx, next.gy)) return false;
              if (isWarningAt(next.gx, next.gy)) return false;
              return true;
            });
            const safe = valid.length ? valid : DIRECTIONS.filter((d) => {
              const next = nextGridPosition(en.gx, en.gy, d);
              return isInsideBoard(next.gx, next.gy);
            });
            if (!safe.length) continue;
            const distTo = (d: Direction, tx: number, ty: number) => {
              const next = nextGridPosition(en.gx, en.gy, d);
              return manhattanDistance(next, { gx: tx, gy: ty });
            };
            const enemyPos = { gx: en.gx, gy: en.gy };
            const bootsDist = boots ? manhattanDistance(enemyPos, boots) : Infinity;
            const arrowDist = arrow ? manhattanDistance(enemyPos, arrow) : Infinity;
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
              chosen = rng.pick(safe);
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
      removeWindowErrorHandlers?.();
      if (keyHandler) window.removeEventListener("keydown", keyHandler);
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      if (window.render_game_to_text) delete window.render_game_to_text;
      if (window.advanceTime) delete window.advanceTime;
      try {
        if (app.canvas && app.canvas.parentNode === host) host.removeChild(app.canvas);
        app.destroy(true, { children: true });
      } catch {
        // Pixi may already have been torn down during hot reload.
      }
    };
  }, [level, roundIndex, roundDuration]);

  const playerSkin = SKINS[PLAYER_SKIN];
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const urgent = timeLeft <= 10 && timeLeft > 0;
  const winner: SkinId = activeSkins.reduce((best, id) =>
    banked[id] > banked[best] ? id : best, activeSkins[0]);
  const topScore = banked[winner];
  const isTie = activeSkins.filter((id) => banked[id] === topScore).length > 1;

  const modalOpen = gameOver || settingsOpen || tutorialOpen;
  const backgroundInertProps = inertBackgroundProps(modalOpen);
  const settingsInertProps = inertBackgroundProps(tutorialOpen);

  return (
    <>
      <div
        {...backgroundInertProps}
        className="fixed inset-0"
        style={{
          touchAction: "none",
          userSelect: "none",
          backgroundImage: `url(${BACKGROUND_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        ref={containerRef}
      />

      {/* Scoreboard */}
      <div
        {...backgroundInertProps}
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
        {...backgroundInertProps}
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

      {/* Match wins HUD (player vs bots, first to 3) */}
      <div
        {...backgroundInertProps}
        className="fixed right-4 z-50 rounded-lg bg-black/55 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm shadow-lg"
        style={{ touchAction: "none", top: "calc(env(safe-area-inset-top, 0px) + 56px)" }}
      >
        <div className="text-white/60 uppercase tracking-wider text-[9px]">Lvl {level} · BO{WINS_TO_PASS * 2 - 1}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span style={{ color: SKINS[PLAYER_SKIN].uiColor }}>You {matchWins[PLAYER_SKIN]}</span>
          <span className="text-white/40">vs</span>
          <span className="text-white/90">Bots {Math.max(0, ...activeBotSkins.map((b) => matchWins[b]))}</span>
          <span className="text-white/40">/ {WINS_TO_PASS}</span>
        </div>
      </div>

      {/* Round Over overlay */}
      {gameOver && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className="rounded-2xl bg-zinc-900/95 px-8 py-7 text-center shadow-2xl ring-1 ring-white/10 min-w-[280px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="round-over-title"
          >
            <div className="text-xs font-bold uppercase tracking-widest text-white/50">End of Round · Level {level}</div>
            <div id="round-over-title" className="mt-2 text-3xl font-extrabold text-white">
              {isTie ? "It's a Tie!" : (
                <span style={{ color: SKINS[winner].uiColor }}>
                  {SKINS[winner].name} wins!
                </span>
              )}
            </div>
            <div className="mt-4 text-[11px] font-bold uppercase tracking-widest text-white/50 text-left">
              Match score (first to {WINS_TO_PASS})
            </div>
            <div className="mt-2 space-y-2 text-left">
              {activeSkins.map((id) => {
                const projectedWins = matchWins[id] + (!isTie && id === winner ? 1 : 0);
                return (
                  <div key={id} className="flex items-center justify-between gap-4 rounded-lg bg-white/5 px-3 py-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ background: SKINS[id].uiColor }} />
                      <span className="font-bold truncate" style={{ color: SKINS[id].uiColor }}>{SKINS[id].name}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-xs text-white/60 tabular-nums">{banked[id]} pts</span>
                      <span className="font-mono text-lg font-extrabold text-white tabular-nums">
                        {projectedWins}
                        <span className="text-white/40 text-xs font-bold">/{WINS_TO_PASS}</span>
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            {history.length > 0 && (
              <>
                <div className="mt-5 text-[11px] font-bold uppercase tracking-widest text-white/50 text-left">
                  Previous rounds
                </div>
                <div className="mt-2 space-y-1.5 text-left max-h-48 overflow-y-auto pr-1">
                  {history.map((h, i) => (
                    <div key={i} className="rounded-lg bg-white/5 px-3 py-1.5">
                      <div className="flex items-center justify-between text-[11px] text-white/60">
                        <span className="font-bold uppercase tracking-wider">
                          L{h.level} · R{h.round}
                        </span>
                        <span className="font-bold" style={{ color: h.winner ? SKINS[h.winner].uiColor : undefined }}>
                          {h.winner ? `${SKINS[h.winner].name} won` : "Tie"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {activeSkins.map((id) => (
                          <span key={id} className="flex items-center gap-1 font-mono text-[11px] tabular-nums">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ background: SKINS[id].uiColor }} />
                            <span className="text-white/80">{h.scores[id] ?? 0}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => onRoundEnd(isTie ? null : winner, banked)}
              className="mt-6 w-full rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold uppercase tracking-wider text-black active:scale-95"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Settings gear (top-right) */}
      <button
        {...backgroundInertProps}
        type="button"
        onClick={() => {
          if (started && !gameOver) setPaused(true);
          setSettingsOpen(true);
        }}
        disabled={gameOver}
        className="fixed right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm shadow-lg active:scale-95 disabled:opacity-40"
        style={{ touchAction: "none", top: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
        aria-label="Settings"
      >
        <Settings size={20} />
      </button>

      {/* Pause overlay */}
      {settingsOpen && !gameOver && (
        <div {...settingsInertProps} className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            className="rounded-2xl bg-zinc-900/95 px-7 py-6 text-center shadow-2xl ring-1 ring-white/10 min-w-[280px] max-w-[90vw]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-title"
          >
            <div className="text-xs font-bold uppercase tracking-widest text-white/50">Paused</div>
            <div id="pause-title" className="mt-1 text-2xl font-extrabold text-white">Level {level}</div>
            <div className="mt-3 text-sm text-white/70">
              Bots: <span className="font-bold text-white">{botCount}</span> · Speed{" "}
              <span className="font-bold text-white">×{(700 / enemyIntervalForLevel(level)).toFixed(2)}</span>
            </div>
            <div className="mt-3 text-xs text-white/60">
              Match: You {matchWins[PLAYER_SKIN]} — Bots{" "}
              {Math.max(0, ...activeBotSkins.map((b) => matchWins[b]))} / {WINS_TO_PASS}
            </div>

            <button
              type="button"
              onClick={() => { setSettingsOpen(false); setPaused(false); }}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-sm font-bold uppercase tracking-wider text-black active:scale-95"
            >
              <Play size={16} fill="currentColor" /> Resume
            </button>
            <button
              type="button"
              onClick={() => setTutorialOpen(true)}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/15 active:scale-95"
            >
              How to play?
            </button>
          </div>
        </div>
      )}
      {tutorialOpen && <TutorialModal onClose={() => setTutorialOpen(false)} />}

      <div
        {...backgroundInertProps}
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
        {canShowDebug && (
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
        )}
      </div>
      {canShowDebug && debug && (
        <div
          {...backgroundInertProps}
          className="fixed right-4 bottom-4 z-50 rounded-lg bg-black/75 px-3 py-2 font-mono text-[11px] leading-tight text-emerald-300 backdrop-blur-sm tabular-nums shadow-lg"
        >
          <div className={stats.fps < 50 ? "text-red-400" : "text-emerald-300"}>
            FPS: {stats.fps} <span className="text-white/60">({stats.frameMs.toFixed(2)}ms)</span>
          </div>
          <div className={stats.maxMs > 33 ? "text-amber-300" : "text-white/60"}>
            peak: {stats.maxMs.toFixed(2)} ms
          </div>
          <div className="mt-1 text-cyan-300">paints/s: {stats.paints}</div>
          <div className="text-cyan-300">
            mini: {stats.miniPasses}/s · {stats.miniCells} cells/s
          </div>
          <div className="text-fuchsia-300">
            anims: {stats.anims} · bombs: {stats.bombs} · bots: {stats.enemies}
          </div>
          <div className="mt-1 text-white/50">
            DPR: {Math.min(window.devicePixelRatio || 1, 3)} · zoom: {Math.round(zoom * 100)}%
          </div>
        </div>
      )}
    </>
  );
}

// ============= Level Manager Wrapper =============

export function IsoGrid() {
  const [unlocked, setUnlocked] = useState<number>(1);
  const [level, setLevel] = useState<number>(1);
  const [matchWins, setMatchWins] = useState<Record<SkinId, number>>(() => zeroScores());
  const [phase, setPhase] = useState<"menu" | "playing" | "passed" | "failed">("menu");
  const [roundIdx, setRoundIdx] = useState(0);
  const [lastWinnerName, setLastWinnerName] = useState<string>("");
  const [history, setHistory] = useState<RoundHistoryEntry[]>([]);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    try {
      setUnlocked(readUnlockedLevel(window.localStorage));
      setTutorialOpen(shouldShowTutorial(window.localStorage));
    } catch (err) {
      console.warn("[IsoGrid] localStorage read failed", err);
    }
  }, []);

  const closeTutorial = () => {
    setTutorialOpen(false);
    try {
      markTutorialSeen(window.localStorage);
    } catch (err) {
      console.warn("[IsoGrid] tutorial persistence failed", err);
    }
  };

  const persistUnlocked = (lv: number) => {
    setUnlocked(lv);
    try {
      writeUnlockedLevel(window.localStorage, lv);
    } catch (err) {
      console.warn("[IsoGrid] unlocked level persistence failed", err);
    }
  };

  const startLevel = (lv: number) => {
    setLevel(lv);
    setMatchWins(zeroScores());
    setHistory([]);
    setRoundIdx((r) => r + 1);
    setPhase("playing");
  };

  const handleRoundEnd = (winner: SkinId | null, banked: Record<SkinId, number>) => {
    const next = { ...matchWins };
    if (winner) next[winner] = (next[winner] || 0) + 1;
    setMatchWins(next);

    const bots = BOT_SKINS.slice(0, botsForLevel(level));
    const playerW = next[PLAYER_SKIN];
    const botMax = Math.max(0, ...bots.map((b) => next[b]));
    setLastWinnerName(winner ? SKINS[winner].name : "Tie");

    const newHistory = [...history, { level, round: history.length + 1, winner, scores: banked }];
    setHistory(newHistory);

    if (playerW >= WINS_TO_PASS) {
      const nextUnlocked = Math.min(MAX_LEVEL, Math.max(unlocked, level + 1));
      persistUnlocked(nextUnlocked);
      setPhase("passed");
      return;
    }
    if (botMax >= WINS_TO_PASS) {
      setPhase("failed");
      return;
    }
    // Continue match: launch next round
    setRoundIdx((r) => r + 1);
    setPhase("playing");
  };

  const managerInertProps = inertBackgroundProps(tutorialOpen);

  if (phase === "playing") {
    return (
      <>
        <div {...managerInertProps}>
          <IsoRound
            key={`lvl-${level}-r-${roundIdx}`}
            level={level}
            roundIndex={roundIdx}
            matchWins={matchWins}
            history={history}
            onRoundEnd={handleRoundEnd}
          />
        </div>
        {tutorialOpen && <TutorialModal onClose={closeTutorial} />}
      </>
    );
  }

  return (
    <>
    <div {...managerInertProps} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-zinc-900/95 px-6 py-7 text-center shadow-2xl ring-1 ring-white/10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-menu-title"
      >
        {phase === "passed" && (
          <>
            <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">Level Passed</div>
            <div id="level-menu-title" className="mt-1 text-3xl font-extrabold text-white">Level {level} ✓</div>
            <p className="mt-2 text-sm text-white/70">
              You won {matchWins[PLAYER_SKIN]}–{Math.max(0, ...BOT_SKINS.slice(0, botsForLevel(level)).map((b) => matchWins[b]))}.
            </p>
          </>
        )}
        {phase === "failed" && (
          <>
            <div className="text-xs font-bold uppercase tracking-widest text-rose-400">Level Failed</div>
            <div id="level-menu-title" className="mt-1 text-3xl font-extrabold text-white">Level {level} ✗</div>
            <p className="mt-2 text-sm text-white/70">
              A bot reached {WINS_TO_PASS} wins first. Try again!
            </p>
          </>
        )}
        {phase === "menu" && (
          <>
            <div className="text-xs font-bold uppercase tracking-widest text-white/50">Paint the Grid</div>
            <div id="level-menu-title" className="mt-1 text-3xl font-extrabold text-white">Select Level</div>
            <p className="mt-2 text-xs text-white/60">First to {WINS_TO_PASS} round wins clears the level.</p>
          </>
        )}

        <div className="mt-5 grid grid-cols-5 gap-2">
          {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((lv) => {
            const locked = lv > unlocked;
            const isCurrent = lv === level && phase !== "menu";
            return (
              <button
                key={lv}
                type="button"
                disabled={locked}
                onClick={() => startLevel(lv)}
                className={`aspect-square rounded-lg text-sm font-extrabold transition active:scale-95 ${
                  locked
                    ? "bg-white/5 text-white/30 cursor-not-allowed"
                    : isCurrent
                      ? "bg-amber-400 text-black ring-2 ring-amber-200"
                      : lv <= unlocked
                        ? "bg-emerald-500/90 text-black hover:bg-emerald-400"
                        : "bg-white/10 text-white"
                }`}
                title={locked ? "Locked" : `Level ${lv} · ${botsForLevel(lv)} bot${botsForLevel(lv) > 1 ? "s" : ""}`}
                aria-label={
                  locked
                    ? `Level ${lv} locked`
                    : `Start level ${lv}, ${botsForLevel(lv)} bot${botsForLevel(lv) > 1 ? "s" : ""}`
                }
              >
                {locked ? "🔒" : lv}
              </button>
            );
          })}
        </div>

        <div className="mt-4 text-[11px] text-white/50">
          Bots scale: lvl 1–2 → 1, 3–4 → 2, 5–7 → 3, 8–10 → 4. Bot speed grows each level.
        </div>

        <div className="mt-5 flex gap-2">
          {phase === "passed" && level < MAX_LEVEL && (
            <button
              type="button"
              onClick={() => startLevel(level + 1)}
              className="flex-1 rounded-full bg-emerald-400 px-4 py-3 text-sm font-bold uppercase tracking-wider text-black active:scale-95"
            >
              Next Level
            </button>
          )}
          {phase === "passed" && level >= MAX_LEVEL && (
            <div className="flex-1 rounded-full bg-amber-400 px-4 py-3 text-sm font-extrabold uppercase tracking-wider text-black">
              🏆 All Levels Cleared!
            </div>
          )}
          {phase === "failed" && (
            <button
              type="button"
              onClick={() => startLevel(level)}
              className="flex-1 rounded-full bg-rose-400 px-4 py-3 text-sm font-bold uppercase tracking-wider text-black active:scale-95"
            >
              Retry Level {level}
            </button>
          )}
          {phase === "menu" && (
            <button
              type="button"
              onClick={() => startLevel(unlocked)}
              className="flex-1 rounded-full bg-emerald-400 px-4 py-3 text-sm font-bold uppercase tracking-wider text-black active:scale-95"
            >
              Play Level {unlocked}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setTutorialOpen(true)}
          className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-white/60 hover:text-white underline-offset-2 hover:underline"
        >
          How to play?
        </button>
      </div>
    </div>
    {tutorialOpen && <TutorialModal onClose={closeTutorial} />}
    </>
  );
}

function TutorialModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-zinc-900/95 px-6 py-6 text-left shadow-2xl ring-1 ring-white/10 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
      >
        <div className="text-xs font-bold uppercase tracking-widest text-amber-400">Tutorial</div>
        <div id="tutorial-title" className="mt-1 text-2xl font-extrabold text-white">How to play</div>

        <div className="mt-4 space-y-3 text-sm text-white/80 leading-relaxed">
          <p>
            <span className="font-bold text-white">Goal:</span> move across the grid to paint tiles in your color,
            then collect chests to bank those painted tiles as round points.
          </p>
          <p>
            <span className="font-bold text-white">Scoring:</span> the HUD shows banked points first and your current
            painted tiles as a smaller + value. Chests add the current + value to your bank and clear your active paint.
          </p>
          <p>
            <span className="font-bold text-white">Match:</span> each level is first to <span className="text-emerald-400 font-bold">{WINS_TO_PASS} round wins</span>.
            If a bot reaches {WINS_TO_PASS} wins first, retry the level.
          </p>
        </div>

        <div className="mt-5 space-y-2.5 text-sm text-white/85">
          <div className="flex items-start gap-3 rounded-lg bg-white/5 px-3 py-2">
            <div className="text-xl leading-none">🎁</div>
            <div>
              <div className="font-bold text-white">Chest</div>
              <div className="text-xs text-white/70">Banks your current painted tiles as points, clears those tiles, then respawns elsewhere.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-white/5 px-3 py-2">
            <div className="text-xl leading-none">➤</div>
            <div>
              <div className="font-bold text-white">Arrow</div>
              <div className="text-xs text-white/70">Paints a full line from the arrow tile in its current direction.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-white/5 px-3 py-2">
            <div className="text-xl leading-none">💣</div>
            <div>
              <div className="font-bold text-white">Bomb</div>
              <div className="text-xs text-white/70">Explodes on its exact tile. A hit stuns that player and clears every tile they currently own.</div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-amber-400 px-4 py-3 text-sm font-extrabold uppercase tracking-wider text-black active:scale-95"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
