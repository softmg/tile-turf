import type { Graphics, Sprite, Texture } from "pixi.js";

export interface Bomb {
  gx: number;
  gy: number;
  warning: Sprite | null;
  boom: Sprite | null;
  phase: "warning" | "explosion";
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

export const screenRotation = (d: number) => {
  if (d === 0) return 0;
  if (d === 1) return Math.PI / 2;
  if (d === 2) return Math.PI;
  return -Math.PI / 2;
};
