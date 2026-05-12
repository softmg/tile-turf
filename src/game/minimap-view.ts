import { Container, Graphics } from "pixi.js";
import { BOARD_SIZE, SKINS, UNPAINTED_MINIMAP_COLOR, type SkinId } from "@/game/game-constants";

export const MINI_CELL = 10;
export const MINI_SIZE = BOARD_SIZE * MINI_CELL;

export interface MinimapView {
  container: Container;
  tiles: Graphics[][];
  player: Graphics;
  allEnemies: Graphics[];
  enemies: Graphics[];
  chest: Graphics;
  arrow: Graphics;
  bombs: Graphics;
  position: (screenWidth: number, screenHeight: number) => void;
}

export const createMinimapView = (
  parent: Container,
  enemySkinIds: readonly SkinId[],
): MinimapView => {
  const container = new Container({ label: "minimap" });
  const cellsLayer = new Container({ label: "minimap-cells" });
  const markerLayer = new Container({ label: "minimap-items" });
  const actorLayer = new Container({ label: "minimap-actors" });

  parent.addChild(container);

  const background = new Graphics({ label: "minimap-bg" });
  background.rect(-4, -4, MINI_SIZE + 8, MINI_SIZE + 8).fill({ color: 0x000000, alpha: 0.5 });
  container.addChild(background, cellsLayer, markerLayer, actorLayer);

  const tiles: Graphics[][] = [];
  for (let x = 0; x < BOARD_SIZE; x++) {
    tiles[x] = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      const tile = new Graphics({ label: `minimap-tile-${x}-${y}` });
      tile
        .rect(x * MINI_CELL, y * MINI_CELL, MINI_CELL - 1, MINI_CELL - 1)
        .fill(UNPAINTED_MINIMAP_COLOR);
      cellsLayer.addChild(tile);
      tiles[x][y] = tile;
    }
  }

  const chest = new Graphics({ label: "minimap-chest" });
  chest.visible = false;
  markerLayer.addChild(chest);

  const arrow = new Graphics({ label: "minimap-arrow" });
  arrow.visible = false;
  markerLayer.addChild(arrow);

  const bombs = new Graphics({ label: "minimap-bombs" });
  markerLayer.addChild(bombs);

  const player = new Graphics({ label: "minimap-player" });
  player.circle(0, 0, 3).fill(0xffffff);
  actorLayer.addChild(player);

  const allEnemies = enemySkinIds.map((skinId) => {
    const enemy = new Graphics({ label: `minimap-${skinId}` });
    enemy.circle(0, 0, 3).stroke({ width: 1.5, color: 0xffffff }).fill(SKINS[skinId].minimapColor);
    enemy.visible = false;
    actorLayer.addChild(enemy);
    return enemy;
  });

  return {
    container,
    tiles,
    player,
    allEnemies,
    enemies: [],
    chest,
    arrow,
    bombs,
    position: (screenWidth, screenHeight) => {
      container.x = screenWidth - MINI_SIZE - 16;
      container.y = screenHeight - MINI_SIZE - 16;
    },
  };
};
