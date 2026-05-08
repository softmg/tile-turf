import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Rectangle, Sprite, Texture, FederatedPointerEvent } from "pixi.js";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

const UNPAINTED_TILE_URL = "https://placehold.co/128x64/cccccc/white.png?text=Tile";
const PAINTED_TILE_URL = "https://placehold.co/128x64/ff7700/white.png?text=Painted";
const PLAYER_SPRITE_URL = "https://placehold.co/64x128/3b82f6/white.png?text=Player";

export function IsoGrid() {
  const containerRef = useRef<HTMLDivElement>(null);

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
        backgroundColor: 0x1e293b,
        antialias: true,
      });
      if (destroyed) {
        app.destroy(true, { children: true });
        return;
      }
      host.appendChild(app.canvas);

      const world = new Container();
      world.sortableChildren = true;
      app.stage.addChild(world);
      app.stage.sortableChildren = true;

      const isoPos = (x: number, y: number) => ({
        x: (x - y) * 40,
        y: (x + y) * 20,
      });

      const painted: boolean[][] = [];
      const tiles: Sprite[][] = [];
      for (let x = 0; x < 8; x++) {
        tiles[x] = [];
        painted[x] = [];
        for (let y = 0; y < 8; y++) {
          const tile = Sprite.from(UNPAINTED_TILE_URL);
          tile.anchor.set(0.5, 1);
          const p = isoPos(x, y);
          tile.x = p.x;
          tile.y = p.y + 20; // align bottom of sprite with bottom of diamond
          tile.zIndex = x + y;
          world.addChild(tile);
          tiles[x][y] = tile;
          painted[x][y] = false;
        }
      }

      const shadow = new Graphics();
      shadow.ellipse(0, 0, 20, 10).fill({ color: 0x000000, alpha: 0.4 });
      world.addChild(shadow);

      const player = Sprite.from(PLAYER_SPRITE_URL);
      player.anchor.set(0.5, 1);
      world.addChild(player);

      let playerX = 0;
      let playerY = 0;
      let anim: {
        fromX: number; fromY: number; toX: number; toY: number; start: number;
      } | null = null;
      const JUMP_DURATION = 300;

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
          m.rect(x * MINI_CELL, y * MINI_CELL, MINI_CELL - 1, MINI_CELL - 1).fill(0xcccccc);
          minimap.addChild(m);
          miniTiles[x][y] = m;
        }
      }

      const miniPlayer = new Graphics();
      miniPlayer.circle(0, 0, 3).fill(0x3b82f6);
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
              painted[x][y] ? 0xff7700 : 0xcccccc
            );
          }
        }
        miniPlayer.x = playerX * MINI_CELL + MINI_CELL / 2;
        miniPlayer.y = playerY * MINI_CELL + MINI_CELL / 2;
      };

      const centerCamera = () => {
        const p = isoPos(playerX, playerY);
        world.x = app.screen.width / 2 - p.x;
        world.y = app.screen.height / 2 - p.y;
      };

      const paintAt = (gx: number, gy: number) => {
        painted[gx][gy] = true;
        tiles[gx][gy].texture = Texture.from(PAINTED_TILE_URL);
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
        centerCamera();
      };

      const updatePlayer = () => {
        paintAt(playerX, playerY);
        renderPlayerAt(playerX, playerY);
        updateMinimap();
      };

      positionMinimap();
      updatePlayer();

      app.ticker.add(() => {
        if (!anim) return;
        const now = performance.now();
        const progress = Math.min(1, (now - anim.start) / JUMP_DURATION);
        const gx = anim.fromX + (anim.toX - anim.fromX) * progress;
        const gy = anim.fromY + (anim.toY - anim.fromY) * progress;
        const jumpOffset = Math.sin(progress * Math.PI) * -40;
        const shadowScale = 1 - Math.sin(progress * Math.PI) * 0.4;
        renderPlayerAt(gx, gy, jumpOffset, shadowScale);
        if (progress >= 1) {
          anim = null;
          updatePlayer();
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
        paintAt(playerX, playerY);
        updateMinimap();
        anim = { fromX, fromY, toX: nx, toY: ny, start: performance.now() };
      };

      // ---------- Joystick ----------
      const joystick = new Container();
      joystick.zIndex = 1000;
      joystick.visible = false;
      joystick.scale.y = 0.5;
      app.stage.addChild(joystick);

      const base = new Graphics();
      base.circle(0, 0, 50).fill({ color: 0x000000, alpha: 0.3 });
      joystick.addChild(base);

      const knob = new Graphics();
      knob.circle(0, 0, 25).fill({ color: 0xffffff, alpha: 0.7 });
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
    <div
      className="fixed inset-0"
      style={{ touchAction: "none", userSelect: "none" }}
      ref={containerRef}
    />
  );
}
