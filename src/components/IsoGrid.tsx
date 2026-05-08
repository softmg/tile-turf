import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Rectangle, Sprite, Texture, FederatedPointerEvent, Assets } from "pixi.js";
import tileUrl from "@/assets/tile.png";
import tilePaintedUrl from "@/assets/tile-painted.png";
import playerUrl from "@/assets/player.png";
import backgroundUrl from "@/assets/background.png";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

const TILE_W = 110;
const TILE_H = 70;
const TILE_SIZE = 120;

export function IsoGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [debug, setDebug] = useState(false);
  const debugRef = useRef(false);
  const [stats, setStats] = useState({ fps: 0, frameMs: 0, maxMs: 0 });
  const statsAccum = useRef({ frames: 0, sumMs: 0, maxMs: 0, lastFlush: 0 });

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    debugRef.current = debug;
  }, [debug]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const app = new Application();
    let destroyed = false;
    let keyHandler: ((e: KeyboardEvent) => void) | null = null;
    let resizeHandler: (() => void) | null = null;

    (async () => {
      await app.init({
        resizeTo: window,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 3),
        autoDensity: true,
      });
      if (destroyed) {
        app.destroy(true, { children: true });
        return;
      }
      host.appendChild(app.canvas);

      // Preload textures so sprites have correct dimensions immediately
      const [tileTex, tilePaintedTex, playerTex] = await Promise.all([
        Assets.load(tileUrl),
        Assets.load(tilePaintedUrl),
        Assets.load(playerUrl),
      ]);
      for (const t of [tileTex, tilePaintedTex, playerTex]) {
        if (t && (t as Texture).source) {
          (t as Texture).source.scaleMode = "linear";
          (t as Texture).source.autoGenerateMipmaps = true;
          (t as Texture).source.updateMipmaps?.();
        }
      }
      if (destroyed) return;

      const world = new Container();
      world.sortableChildren = true;
      app.stage.addChild(world);
      app.stage.sortableChildren = true;

      const isoPos = (x: number, y: number) => ({
        x: (x - y) * (TILE_W / 2),
        y: (x + y) * (TILE_H / 2),
      });

      const painted: boolean[][] = [];
      const tiles: Sprite[][] = [];
      for (let x = 0; x < 8; x++) {
        tiles[x] = [];
        painted[x] = [];
        for (let y = 0; y < 8; y++) {
          const tile = new Sprite(tileTex as Texture);
          tile.anchor.set(0.5, 0.5);
          tile.width = TILE_SIZE;
          tile.height = TILE_SIZE;
          const p = isoPos(x, y);
          tile.x = p.x;
          tile.y = p.y;
          tile.zIndex = x + y;
          world.addChild(tile);
          tiles[x][y] = tile;
          painted[x][y] = false;
        }
      }

      const shadow = new Graphics();
      shadow.ellipse(0, 0, 28, 12).fill({ color: 0x000000, alpha: 0.35 });
      world.addChild(shadow);

      const player = new Sprite(playerTex as Texture);
      player.anchor.set(0.5, 0.85);
      const playerScale = 90 / Math.max(player.texture.width, 1);
      player.scale.set(playerScale);
      world.addChild(player);

      let playerX = 0;
      let playerY = 0;
      let anim: { fromX: number; fromY: number; toX: number; toY: number; elapsed: number } | null = null;
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
          m.rect(x * MINI_CELL, y * MINI_CELL, MINI_CELL - 1, MINI_CELL - 1).fill(0xf5d0b0);
          minimap.addChild(m);
          miniTiles[x][y] = m;
        }
      }

      const miniPlayer = new Graphics();
      miniPlayer.circle(0, 0, 3).fill(0xffffff);
      miniPlayer.zIndex = 10;
      minimap.addChild(miniPlayer);

      const positionMinimap = () => {
        minimap.x = app.screen.width - MINI_SIZE - 20;
        minimap.y = 20;
      };

      const updateMinimap = () => {
        for (let x = 0; x < 8; x++) {
          for (let y = 0; y < 8; y++) {
            const m = miniTiles[x][y];
            m.clear();
            m.rect(x * MINI_CELL, y * MINI_CELL, MINI_CELL - 1, MINI_CELL - 1).fill(
              painted[x][y] ? 0xf97464 : 0xf5d0b0
            );
          }
        }
        miniPlayer.x = playerX * MINI_CELL + MINI_CELL / 2;
        miniPlayer.y = playerY * MINI_CELL + MINI_CELL / 2;
      };

      let cameraTargetX = 0;
      let cameraTargetY = 0;
      let cameraInitialized = false;

      const computeCameraTarget = () => {
        const z = zoomRef.current;
        const p = isoPos(playerX, playerY);
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

      const paintAt = (gx: number, gy: number) => {
        painted[gx][gy] = true;
        tiles[gx][gy].texture = tilePaintedTex as Texture;
      };

      const renderPlayerAt = (gx: number, gy: number, jumpOffset = 0, shadowScale = 1) => {
        const p = isoPos(gx, gy);
        player.x = p.x;
        player.y = p.y + jumpOffset;
        player.zIndex = gx + gy + 0.1;
        shadow.x = p.x;
        shadow.y = p.y;
        shadow.zIndex = gx + gy + 0.05;
        shadow.scale.set(shadowScale, shadowScale);
      };

      const updatePlayer = () => {
        paintAt(playerX, playerY);
        renderPlayerAt(playerX, playerY);
        updateMinimap();
      };

      positionMinimap();
      updatePlayer();

      // easeInOutCubic for smoother horizontal motion
      const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

      app.ticker.add((ticker) => {
        const dtMs = ticker.deltaMS;

        // Debug stats sampling (flush ~5x per second)
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
            s.frames = 0;
            s.sumMs = 0;
            s.maxMs = 0;
            s.lastFlush = now;
          }
        }

        // Smooth zoom toward target
        const zSmooth = 1 - Math.exp(-dtMs / 100);
        const curScale = world.scale.x;
        const nextScale = curScale + (zoomRef.current - curScale) * zSmooth;
        world.scale.set(nextScale);

        // Smooth camera lerp toward target, framerate-independent
        computeCameraTarget();
        const camSmooth = 1 - Math.exp(-dtMs / 80);
        world.x += (cameraTargetX - world.x) * camSmooth;
        world.y += (cameraTargetY - world.y) * camSmooth;

        if (!anim) return;
        anim.elapsed += dtMs;
        const linear = Math.min(1, anim.elapsed / JUMP_DURATION);
        const t = ease(linear);
        const gx = anim.fromX + (anim.toX - anim.fromX) * t;
        const gy = anim.fromY + (anim.toY - anim.fromY) * t;
        const jumpOffset = Math.sin(linear * Math.PI) * -55;
        const shadowScale = 1 - Math.sin(linear * Math.PI) * 0.5;
        renderPlayerAt(gx, gy, jumpOffset, shadowScale);
        if (linear >= 1) {
          anim = null;
          paintAt(playerX, playerY);
          renderPlayerAt(playerX, playerY);
          updateMinimap();
        }
      });

      const movePlayer = (direction: Direction) => {
        if (anim) return;
        let nx = playerX;
        let ny = playerY;
        if (direction === "UP") ny -= 1;
        else if (direction === "DOWN") ny += 1;
        else if (direction === "LEFT") nx -= 1;
        else if (direction === "RIGHT") nx += 1;
        if (nx < 0 || nx > 7 || ny < 0 || ny > 7) return;
        const fromX = playerX;
        const fromY = playerY;
        playerX = nx;
        playerY = ny;
        // Update minimap dot immediately, but paint tile only on landing
        updateMinimap();
        anim = { fromX, fromY, toX: nx, toY: ny, elapsed: 0 };
      };

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
        knob.x = 0;
        knob.y = 0;
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
          case "ArrowUp":
          case "w":
          case "W":
            dir = "UP";
            break;
          case "ArrowDown":
          case "s":
          case "S":
            dir = "DOWN";
            break;
          case "ArrowLeft":
          case "a":
          case "A":
            dir = "LEFT";
            break;
          case "ArrowRight":
          case "d":
          case "D":
            dir = "RIGHT";
            break;
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
