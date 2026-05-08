import { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export function IsoGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const moveRef = useRef<(d: Direction) => void>(() => {});

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

      moveRef.current = movePlayer;

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

  const press = (dir: Direction) => (e: React.SyntheticEvent) => {
    e.preventDefault();
    moveRef.current(dir);
  };

  const btn =
    "flex items-center justify-center w-14 h-14 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white shadow-lg active:bg-black/70 active:scale-95 transition";

  return (
    <div
      className="relative w-full flex justify-center"
      style={{ touchAction: "none", userSelect: "none" }}
    >
      <div ref={containerRef} className="max-w-full overflow-hidden" />
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2"
        style={{ touchAction: "none", userSelect: "none" }}
      >
        <div className="grid grid-cols-3 grid-rows-3 gap-2 w-52 h-52 p-2 rounded-3xl bg-black/30 backdrop-blur-md border border-white/10">
          <div />
          <button
            aria-label="Up"
            className={btn}
            onPointerDown={press("UP")}
            onTouchStart={press("UP")}
          >
            <ChevronUp />
          </button>
          <div />
          <button
            aria-label="Left"
            className={btn}
            onPointerDown={press("LEFT")}
            onTouchStart={press("LEFT")}
          >
            <ChevronLeft />
          </button>
          <div />
          <button
            aria-label="Right"
            className={btn}
            onPointerDown={press("RIGHT")}
            onTouchStart={press("RIGHT")}
          >
            <ChevronRight />
          </button>
          <div />
          <button
            aria-label="Down"
            className={btn}
            onPointerDown={press("DOWN")}
            onTouchStart={press("DOWN")}
          >
            <ChevronDown />
          </button>
          <div />
        </div>
      </div>
    </div>
  );
}
