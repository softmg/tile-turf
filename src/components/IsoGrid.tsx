import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Rectangle, FederatedPointerEvent } from "pixi.js";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export function IsoGrid() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const app = new Application();
    let destroyed = false;
    let keyHandler: ((e: KeyboardEvent) => void) | null = null;

    (async () => {
      await app.init({ width: 800, height: 600, backgroundColor: 0x1e293b, antialias: true });
      if (destroyed) {
        app.destroy(true, { children: true });
        return;
      }
      host.appendChild(app.canvas);

      const world = new Container();
      world.sortableChildren = true;
      app.stage.addChild(world);

      const isoPos = (x: number, y: number) => ({
        x: (x - y) * 40 + 400,
        y: (x + y) * 20 + 150,
      });

      const drawTile = (g: Graphics, painted: boolean) => {
        g.clear();
        g.poly([0, -20, 40, 0, 0, 20, -40, 0]);
        g.fill(painted ? 0xff7700 : 0xcccccc);
        g.stroke({ width: 2, color: 0x555555 });
      };

      const tiles: Graphics[][] = [];
      for (let x = 0; x < 8; x++) {
        tiles[x] = [];
        for (let y = 0; y < 8; y++) {
          const tile = new Graphics();
          drawTile(tile, false);
          const p = isoPos(x, y);
          tile.x = p.x;
          tile.y = p.y;
          tile.zIndex = x + y;
          world.addChild(tile);
          tiles[x][y] = tile;
        }
      }

      const player = new Graphics();
      player.rect(-10, -40, 20, 40);
      player.fill(0x3b82f6);
      player.stroke({ width: 2, color: 0x1e3a8a });
      world.addChild(player);

      let playerX = 0;
      let playerY = 0;

      const updatePlayer = () => {
        drawTile(tiles[playerX][playerY], true);
        const p = isoPos(playerX, playerY);
        player.x = p.x;
        player.y = p.y;
        player.zIndex = playerX + playerY + 0.1;
      };

      updatePlayer();

      const movePlayer = (direction: Direction) => {
        let nx = playerX;
        let ny = playerY;
        if (direction === "UP") ny -= 1;
        else if (direction === "DOWN") ny += 1;
        else if (direction === "LEFT") nx -= 1;
        else if (direction === "RIGHT") nx += 1;
        if (nx < 0 || nx > 7 || ny < 0 || ny > 7) return;
        playerX = nx;
        playerY = ny;
        updatePlayer();
      };

      // ---------- Joystick ----------
      const joystick = new Container();
      joystick.zIndex = 1000;
      joystick.visible = false;
      joystick.scale.y = 0.5;
      app.stage.sortableChildren = true;
      app.stage.addChild(joystick);

      const base = new Graphics();
      base.circle(0, 0, 50).fill({ color: 0x000000, alpha: 0.3 });
      joystick.addChild(base);

      const knob = new Graphics();
      knob.circle(0, 0, 25).fill({ color: 0xffffff, alpha: 0.7 });
      joystick.addChild(knob);

      app.stage.eventMode = "static";
      app.stage.hitArea = new Rectangle(0, 0, 800, 600);

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
        // dx/dy in screen space
        const dx = e.global.x - baseX;
        const dy = e.global.y - baseY;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(dist, MAX_RADIUS);
        const angle = Math.atan2(dy, dx);
        // knob position is in joystick local space; since scale.y=0.5, divide y by 0.5 to render in screen pixels
        knob.x = Math.cos(angle) * clamped;
        knob.y = (Math.sin(angle) * clamped) / 0.5;

        if (dist < THRESHOLD) return;
        const now = performance.now();
        if (now - lastMoveTime < COOLDOWN) return;

        // Isometric mapping based on screen-space angle (degrees)
        const deg = (angle * 180) / Math.PI; // -180..180, 0 = right
        let dir: Direction;
        if (deg >= -90 && deg < 0) dir = "UP"; // top-right
        else if (deg >= 0 && deg < 90) dir = "RIGHT"; // bottom-right
        else if (deg >= 90 && deg <= 180) dir = "DOWN"; // bottom-left
        else dir = "LEFT"; // top-left

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
    })();

    return () => {
      destroyed = true;
      if (keyHandler) window.removeEventListener("keydown", keyHandler);
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
      className="relative w-full flex justify-center"
      style={{ touchAction: "none", userSelect: "none" }}
    >
      <div ref={containerRef} className="max-w-full overflow-hidden" />
    </div>
  );
}
