import { Rectangle, Texture } from "pixi.js";

export const BOMB_WARNING_DURATION_MS = 2000;
export const BOMB_ANIM_FRAME_W = 512;
export const BOMB_ANIM_FRAME_H = 576;
export const BOMB_ANIM_COLS = 5;
export const BOMB_ANIM_ROWS = 5;
export const BOMB_ANIM_FRAME_COUNT = BOMB_ANIM_COLS * BOMB_ANIM_ROWS;
export const BOMB_EXPLOSION_START_FRAME = 16;
export const BOMB_DETONATION_MS =
  (BOMB_WARNING_DURATION_MS * BOMB_EXPLOSION_START_FRAME) / BOMB_ANIM_FRAME_COUNT;

const BOMB_ANIM_FRAME_ANCHOR = { x: 0.4971, y: 0.7691 } as const;
const BOMB_ANIM_SOURCE_PAD = 10;
const BOMB_ANIM_SHEET_W = BOMB_ANIM_FRAME_W * BOMB_ANIM_COLS;
const BOMB_ANIM_SHEET_H = BOMB_ANIM_FRAME_H * BOMB_ANIM_ROWS;

export type BombWarningFrame = {
  texture: Texture;
  anchor: { x: number; y: number };
};

/**
 * Slices the bomb warning sprite sheet into padded frames so each frame keeps
 * a stable visual anchor while the warning animation grows into detonation.
 */
export const createBombWarningFrames = (sheet: Texture) => {
  const frames: BombWarningFrame[] = [];
  const origWidth = BOMB_ANIM_FRAME_W + BOMB_ANIM_SOURCE_PAD * 2;
  const origHeight = BOMB_ANIM_FRAME_H + BOMB_ANIM_SOURCE_PAD;
  const anchor = {
    x: (BOMB_ANIM_SOURCE_PAD + BOMB_ANIM_FRAME_ANCHOR.x * BOMB_ANIM_FRAME_W) / origWidth,
    y: (BOMB_ANIM_SOURCE_PAD + BOMB_ANIM_FRAME_ANCHOR.y * BOMB_ANIM_FRAME_H) / origHeight,
  };
  for (let row = 0; row < BOMB_ANIM_ROWS; row++) {
    for (let col = 0; col < BOMB_ANIM_COLS; col++) {
      const cellX = col * BOMB_ANIM_FRAME_W;
      const cellY = row * BOMB_ANIM_FRAME_H;
      const desiredX = cellX - BOMB_ANIM_SOURCE_PAD;
      const desiredY = cellY - BOMB_ANIM_SOURCE_PAD;
      const sourceX = Math.max(0, desiredX);
      const sourceY = Math.max(0, desiredY);
      const sourceRight = Math.min(BOMB_ANIM_SHEET_W, cellX + BOMB_ANIM_FRAME_W + BOMB_ANIM_SOURCE_PAD);
      const sourceBottom = Math.min(BOMB_ANIM_SHEET_H, cellY + BOMB_ANIM_FRAME_H);
      const sourceW = sourceRight - sourceX;
      const sourceH = sourceBottom - sourceY;
      frames.push({
        texture: new Texture({
          source: sheet.source,
          orig: new Rectangle(0, 0, origWidth, origHeight),
          frame: new Rectangle(sourceX, sourceY, sourceW, sourceH),
          trim: new Rectangle(sourceX - desiredX, sourceY - desiredY, sourceW, sourceH),
        }),
        anchor,
      });
    }
  }
  return frames;
};

export const bombWarningFrameForElapsed = (frames: BombWarningFrame[], elapsedMs: number) => {
  const frameDuration = BOMB_WARNING_DURATION_MS / frames.length;
  const index = Math.min(frames.length - 1, Math.floor(elapsedMs / frameDuration));
  return frames[index];
};
