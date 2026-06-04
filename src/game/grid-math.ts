import { BOARD_SIZE, TILE_H, TILE_W, type Direction } from "@/game/game-constants";

export interface GridPosition {
  gx: number;
  gy: number;
}

export const isoPos = (x: number, y: number) => ({
  x: (x - y) * (TILE_W / 2),
  y: (x + y) * (TILE_H / 2),
});

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
