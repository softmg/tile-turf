import { Graphics, Sprite, type Texture } from "pixi.js";
import { BOARD_SIZE, SKINS, TILE_SIZE, type SkinId } from "@/game/game-constants";
import { isoPos } from "@/game/grid-math";
import { hazardSpriteScale, isoRotation } from "@/game/hazards";
import { DEPTH_OFFSETS, isoDepth } from "@/game/scene-layers";

export type SkinTextureMap = Record<SkinId, { tile: Texture; player: Texture }>;

export interface CharacterView {
  shadow: Graphics;
  aura: Graphics;
  sprite: Sprite;
}

export const BOMB_TARGET_H = 170;
export const BOOM_TARGET_H = 220;
const BOMB_ANCHOR_Y = 280 / 520;
const CHEST_Y_OFFSET = 14;
const BOOTS_Y_OFFSET = -14;
const BOOST_AURA_Y_OFFSET = -30;
const BOOST_AURA_DEPTH_OFFSET = -0.01;

export const createBoardTile = (texture: Texture, gx: number, gy: number) => {
  const tile = new Sprite(texture);
  tile.label = `board-tile-${gx}-${gy}`;
  tile.anchor.set(0.5, 0.5);
  tile.width = TILE_SIZE;
  tile.height = TILE_SIZE;
  const p = isoPos(gx, gy);
  tile.x = p.x;
  tile.y = p.y;
  return tile;
};

export const addBoardTilesInIsoOrder = (
  createTile: (gx: number, gy: number) => Sprite,
  addTile: (tile: Sprite) => void,
) => {
  for (let depth = 0; depth <= (BOARD_SIZE - 1) * 2; depth++) {
    for (let gx = 0; gx < BOARD_SIZE; gx++) {
      const gy = depth - gx;
      if (gy < 0 || gy >= BOARD_SIZE) continue;
      addTile(createTile(gx, gy));
    }
  }
};

export const createCharacterView = (skinId: SkinId, textures: SkinTextureMap): CharacterView => {
  const skin = SKINS[skinId];
  const shadow = new Graphics({ label: `${skinId}-shadow` });
  shadow.ellipse(0, 0, 28, 12).fill({ color: 0x000000, alpha: 0.35 });

  const aura = new Graphics({ label: `${skinId}-aura` });
  aura
    .circle(0, 0, 36)
    .fill({ color: 0x00ffff, alpha: 0.35 })
    .stroke({ width: 2, color: 0x00ffff, alpha: 0.9 });
  aura.visible = false;

  const tex = textures[skinId].player;
  const sprite = new Sprite(tex);
  sprite.label = `${skinId}-body`;
  sprite.anchor.set(0.5, 0.85);
  const targetH = 110;
  const s = targetH / Math.max(tex.height, 1);
  sprite.scale.set(s);
  sprite.tint = skin.spriteTint;

  return { shadow, aura, sprite };
};

export const placeCharacterView = (
  view: CharacterView,
  gx: number,
  gy: number,
  jumpOffset = 0,
  shadowScale = 1,
) => {
  const p = isoPos(gx, gy);
  view.sprite.x = p.x;
  view.sprite.y = p.y + jumpOffset;
  view.sprite.zIndex = isoDepth(gx, gy, DEPTH_OFFSETS.CHARACTER_BODY);
  view.shadow.x = p.x;
  view.shadow.y = p.y;
  view.shadow.zIndex = isoDepth(gx, gy, DEPTH_OFFSETS.CHARACTER_SHADOW);
  view.shadow.scale.set(shadowScale, shadowScale);
};

export const placeBoostAura = (view: CharacterView, nowMs: number) => {
  view.aura.x = view.sprite.x;
  view.aura.y = view.sprite.y + BOOST_AURA_Y_OFFSET;
  view.aura.zIndex = view.sprite.zIndex + BOOST_AURA_DEPTH_OFFSET;
  view.aura.alpha = 0.6 + 0.3 * Math.sin(nowMs / 120);
};

export const createChestSprite = (texture: Texture) => {
  const sprite = new Sprite(texture);
  sprite.label = "chest";
  sprite.anchor.set(0.5, 1);
  const targetH = 80;
  const s = targetH / Math.max(texture.height, 1);
  sprite.scale.set(s);
  return sprite;
};

export const placeChestSprite = (sprite: Sprite, gx: number, gy: number) => {
  const p = isoPos(gx, gy);
  sprite.x = p.x;
  sprite.y = p.y + CHEST_Y_OFFSET;
  sprite.zIndex = isoDepth(gx, gy, DEPTH_OFFSETS.CHEST);
};

export const createBombWarningSprite = (texture: Texture, gx: number, gy: number) => {
  const p = isoPos(gx, gy);
  const warning = new Sprite(texture);
  warning.label = "bomb-warning";
  warning.anchor.set(0.5, BOMB_ANCHOR_Y);
  warning.scale.set(hazardSpriteScale(texture, BOMB_TARGET_H));
  warning.x = p.x;
  warning.y = p.y;
  warning.zIndex = isoDepth(gx, gy, DEPTH_OFFSETS.BOMB_WARNING);
  return warning;
};

export const updateBombWarningSprite = (warning: Sprite, texture: Texture) => {
  warning.texture = texture;
  warning.scale.set(hazardSpriteScale(texture, BOMB_TARGET_H));
};

export const createBombExplosionSprite = (texture: Texture, gx: number, gy: number) => {
  const p = isoPos(gx, gy);
  const boom = new Sprite(texture);
  boom.label = "bomb-explosion";
  boom.anchor.set(0.5, BOMB_ANCHOR_Y);
  boom.scale.set(hazardSpriteScale(texture, BOOM_TARGET_H));
  boom.x = p.x;
  boom.y = p.y;
  boom.zIndex = isoDepth(gx, gy, DEPTH_OFFSETS.BOMB_EXPLOSION);
  return boom;
};

export const updateBombExplosionSprite = (boom: Sprite, texture: Texture, progress: number) => {
  const s = hazardSpriteScale(texture, BOOM_TARGET_H) * (0.4 + 0.6 * progress);
  boom.scale.set(s);
};

export const createBootsSprite = (texture: Texture, gx: number, gy: number) => {
  const p = isoPos(gx, gy);
  const gfx = new Sprite(texture);
  gfx.label = "boots";
  gfx.anchor.set(0.5, 0.5);
  const targetH = 70;
  const s = targetH / Math.max(texture.height, 1);
  gfx.scale.set(s);
  gfx.x = p.x;
  gfx.y = p.y + BOOTS_Y_OFFSET;
  gfx.zIndex = isoDepth(gx, gy, DEPTH_OFFSETS.BOOTS);
  return gfx;
};

export const createArrowGraphic = (gx: number, gy: number, dir = 0) => {
  const p = isoPos(gx, gy);
  const gfx = new Graphics({ label: "rotating-arrow" });
  gfx
    .poly([0, -22, 14, 0, 6, 0, 6, 22, -6, 22, -6, 0, -14, 0])
    .fill(0xffffff)
    .stroke({ width: 2, color: 0x222222 });
  gfx.circle(0, 0, 26).stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
  gfx.x = p.x;
  gfx.y = p.y;
  gfx.zIndex = isoDepth(gx, gy, DEPTH_OFFSETS.ARROW);
  gfx.rotation = isoRotation(dir);
  return gfx;
};

export const setArrowDirection = (gfx: Graphics, dir: number) => {
  gfx.rotation = isoRotation(dir);
};
