import type { Graphics, Sprite } from "pixi.js";
import type { SkinConfig } from "@/game/game-constants";

export interface CharacterAnimation {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  elapsed: number;
  duration: number;
  arrowDir: number | null;
}

export interface Character {
  skin: SkinConfig;
  sprite: Sprite;
  shadow: Graphics;
  gx: number;
  gy: number;
  anim: CharacterAnimation | null;
  stunnedUntil: number;
  boostUntil: number;
  aura: Graphics;
}
