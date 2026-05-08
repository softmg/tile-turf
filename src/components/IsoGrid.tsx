import { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";

export function IsoGrid() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const app = new Application();
    let destroyed = false;

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

      const drawTile = (g: Graphics, painted: boolean) => {
        g.clear();
        g.poly([0, -20, 40, 0, 0, 20, -40, 0]);
        g.fill(painted ? 0xff7700 : 0xcccccc);
        g.stroke({ width: 2, color: 0x555555 });
      };

      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          const tile = new Graphics();
          drawTile(tile, false);
          tile.x = (x - y) * 40 + 400;
          tile.y = (x + y) * 20 + 150;
          tile.zIndex = x + y;
          tile.eventMode = "static";
          tile.cursor = "pointer";
          let painted = false;
          tile.on("pointertap", () => {
            painted = !painted;
            drawTile(tile, painted);
          });
          world.addChild(tile);
        }
      }
    })();

    return () => {
      destroyed = true;
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
