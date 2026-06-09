import type { Container, Graphics, Sprite } from "pixi.js";
import type { SkinConfig } from "@/game/game-constants";

export interface CharacterAnimation {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  elapsed: number;
  duration: number;
}

export interface Character {
  skin: SkinConfig;
  sprite: Sprite;
  shadow: Graphics;
  bodyBaseScale: number;
  gx: number;
  gy: number;
  anim: CharacterAnimation | null;
  landingSquashElapsed: number | null;
  stunnedUntil: number;
  stunStars: Container;
  boostUntil: number;
  aura: Graphics;
}
