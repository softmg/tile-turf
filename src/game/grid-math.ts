import { BOARD_SIZE, TILE_STEP_X, TILE_STEP_Y, type Direction } from "@/game/game-constants";

export interface GridPosition {
  gx: number;
  gy: number;
}

export const perspectiveScale = (y: number) => {
  const t = BOARD_SIZE <= 1 ? 0 : y / (BOARD_SIZE - 1);
  return 0.78 + t * 0.34;
};

export const gridPos = (x: number, y: number) => ({
  x: (x - (BOARD_SIZE - 1) / 2) * TILE_STEP_X * perspectiveScale(y),
  y: y * TILE_STEP_Y,
});

export const boardBounds = (tileSize: number) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < BOARD_SIZE; y++) {
    const scale = perspectiveScale(y);
    for (let x = 0; x < BOARD_SIZE; x++) {
      const p = gridPos(x, y);
      const half = (tileSize * scale) / 2;
      minX = Math.min(minX, p.x - half);
      maxX = Math.max(maxX, p.x + half);
      minY = Math.min(minY, p.y - half);
      maxY = Math.max(maxY, p.y + half);
    }
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

export const isInsideBoard = (gx: number, gy: number) =>
  gx >= 0 && gx < BOARD_SIZE && gy >= 0 && gy < BOARD_SIZE;

export const nextGridPosition = (gx: number, gy: number, direction: Direction): GridPosition => {
  if (direction === "UP") return { gx, gy: gy - 1 };
  if (direction === "DOWN") return { gx, gy: gy + 1 };
  if (direction === "LEFT") return { gx: gx - 1, gy };
  return { gx: gx + 1, gy };
};

export const manhattanDistance = (a: GridPosition, b: GridPosition) =>
  Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy);
