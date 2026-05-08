import { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";

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

      // Player
      const player = new Graphics();
      player.rect(-10, -40, 20, 40);
      player.fill(0x3b82f6);
      player.stroke({ width: 2, color: 0x1e3a8a });
      world.addChild(player);

      let playerX = 0;
      let playerY = 0;

      const paintAndPlace = () => {
        drawTile(tiles[playerX][playerY], true);
        const p = isoPos(playerX, playerY);
        player.x = p.x;
        player.y = p.y;
        player.zIndex = playerX + playerY + 0.1;
      };

      paintAndPlace();

      keyHandler = (e: KeyboardEvent) => {
        let nx = playerX;
        let ny = playerY;
        switch (e.key) {
          case "ArrowUp":
          case "w":
          case "W":
            ny -= 1;
            break;
          case "ArrowDown":
          case "s":
          case "S":
            ny += 1;
            break;
          case "ArrowLeft":
          case "a":
          case "A":
            nx -= 1;
            break;
          case "ArrowRight":
          case "d":
          case "D":
            nx += 1;
            break;
          default:
            return;
        }
        if (nx < 0 || nx > 7 || ny < 0 || ny > 7) return;
        e.preventDefault();
        playerX = nx;
        playerY = ny;
        paintAndPlace();
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

  return <div ref={containerRef} className="flex justify-center" />;
}
