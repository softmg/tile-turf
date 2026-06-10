import type { Graphics, Sprite, Texture } from "pixi.js";
import { TILE_H, TILE_W } from "@/game/game-constants";

export interface Bomb {
  gx: number;
  gy: number;
  warning: Sprite | null;
  dangerMarkers: Graphics[];
  boom: Sprite | null;
  phase: "warning" | "explosion";
  detonated: boolean;
  warningElapsed: number;
  explosionElapsed: number;
}

export interface ArrowState {
  gx: number;
  gy: number;
  dir: number;
  gfx: Graphics;
  rotateElapsed: number;
  lifeElapsed: number;
}

export const hazardSpriteScale = (tex: Texture, target: number) => target / Math.max(tex.height, 1);

export const arrowDirectionVector = (d: number): [number, number] => {
  if (d === 0) return [-TILE_W / 2, -TILE_H / 2];
  if (d === 1) return [TILE_W / 2, -TILE_H / 2];
  if (d === 2) return [TILE_W / 2, TILE_H / 2];
  return [-TILE_W / 2, TILE_H / 2];
};

export const isoRotation = (d: number) => {
  const [vx, vy] = arrowDirectionVector(d);
  return Math.atan2(vx, -vy);
};
