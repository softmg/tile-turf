import { ColorMatrixFilter, Container, Graphics, Sprite, type Texture } from "pixi.js";
import { BOARD_SIZE, SKINS, TILE_H, TILE_SIZE, TILE_W, type SkinConfig, type SkinId } from "@/game/game-constants";
import { isoPos } from "@/game/grid-math";
import { hazardSpriteScale, isoRotation } from "@/game/hazards";
import { DEPTH_OFFSETS, isoDepth } from "@/game/scene-layers";

export type SkinTextureMap = Record<SkinId, { tile: Texture; player: Texture }>;

export interface CharacterView {
  shadow: Graphics;
  aura: Graphics;
  sprite: Sprite;
  bodyBaseScale: number;
}

export const BOMB_TARGET_H = 102;
const BOMB_WARNING_ANCHOR_X = 255.5 / 512;
const BOMB_WARNING_ANCHOR_Y = 453 / 480;
const CHEST_Y_OFFSET = 14;
const TILE_TOP_CENTER_Y_OFFSET = -18;
const BOOTS_Y_OFFSET = TILE_TOP_CENTER_Y_OFFSET;
const ARROW_Y_OFFSET = TILE_TOP_CENTER_Y_OFFSET;
const BOOST_AURA_Y_OFFSET = -30;
const BOOST_AURA_DEPTH_OFFSET = -0.01;
const TILE_PAINT_REVEAL_MS = 300;
const TILE_JUMP_LIFT_PX = 5;
const TILE_JUMP_LIFT_EASE = 0.16;
const TILE_JUMP_WOBBLE_AMPLITUDE_PX = 1.6;
const TILE_JUMP_WOBBLE_FREQUENCY = 0.006;
const TILE_JUMP_BRIGHTNESS_BOOST = 0.16;

const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

export class BoardTileView {
  readonly container: Container;
  private visual: Container;
  private baseSprite: Sprite;
  private paintedSprite: Sprite;
  private paintMask: Graphics;
  private brightnessFilter: ColorMatrixFilter;
  private paintProgress = 0;
  private paintChangedAt = 0;
  private paintChangedFrom = 0;
  private paintAnimating = false;
  private jumpAvailable = false;
  private jumpLift = 0;
  private visualOwner: SkinId | null = null;

  constructor(
    private unpaintedTexture: Texture,
    private paintedTexture: Texture,
    gx: number,
    gy: number,
  ) {
    this.container = new Container({ label: `board-tile-${gx}-${gy}` });
    this.visual = new Container({ label: `board-tile-visual-${gx}-${gy}` });
    this.baseSprite = this.createTileSprite(unpaintedTexture);
    this.paintedSprite = this.createTileSprite(paintedTexture);
    this.paintedSprite.visible = false;

    this.paintMask = new Graphics({ label: `board-tile-mask-${gx}-${gy}` });
    this.paintedSprite.mask = this.paintMask;

    this.brightnessFilter = new ColorMatrixFilter();
    this.visual.filters = [this.brightnessFilter];

    const p = isoPos(gx, gy);
    this.container.x = p.x;
    this.container.y = p.y;
    this.container.addChild(this.visual);
    this.visual.addChild(this.baseSprite, this.paintedSprite, this.paintMask);
    this.drawPaintMask(0);
  }

  paint(skin: SkinConfig, nowMs: number, options: { immediate?: boolean } = {}) {
    if (this.visualOwner === skin.id && !this.paintAnimating) return false;

    this.baseSprite.texture = this.unpaintedTexture;
    this.baseSprite.tint = this.visualOwner ? SKINS[this.visualOwner].paintTint : 0xffffff;
    this.paintedSprite.texture = this.unpaintedTexture;
    this.paintedSprite.tint = skin.paintTint;
    this.paintedSprite.visible = true;
    this.visualOwner = skin.id;
    this.paintChangedFrom = options.immediate ? 1 : 0;
    this.paintChangedAt = nowMs;
    this.paintAnimating = !options.immediate;
    this.paintProgress = options.immediate ? 1 : 0;
    this.drawPaintMask(this.paintProgress);
    return true;
  }

  resetToUnpainted() {
    this.visualOwner = null;
    this.baseSprite.texture = this.unpaintedTexture;
    this.baseSprite.tint = 0xffffff;
    this.paintedSprite.visible = false;
    this.paintedSprite.tint = 0xffffff;
    this.paintAnimating = false;
    this.paintProgress = 0;
    this.drawPaintMask(0);
  }

  setJumpAvailable(on: boolean) {
    this.jumpAvailable = on;
  }

  update(nowMs: number) {
    this.updatePaint(nowMs);
    this.updateJumpMotion(nowMs);
  }

  private createTileSprite(texture: Texture) {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.width = TILE_SIZE;
    sprite.height = TILE_SIZE;
    return sprite;
  }

  private drawPaintMask(progress: number) {
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const maxRadius = Math.sqrt(hw * hw + hh * hh);
    this.paintMask.clear();
    if (progress <= 0) return;
    this.paintMask.circle(0, 0, maxRadius * progress).fill(0xffffff);
  }

  private updatePaint(nowMs: number) {
    if (!this.paintAnimating) return;
    const raw = (nowMs - this.paintChangedAt) / TILE_PAINT_REVEAL_MS;
    const t = Math.min(1, Math.max(0, raw));
    const eased = easeInOutSine(t);
    this.paintProgress = this.paintChangedFrom + (1 - this.paintChangedFrom) * eased;
    this.drawPaintMask(this.paintProgress);
    if (t >= 1) {
      this.paintProgress = 1;
      this.paintAnimating = false;
      this.drawPaintMask(1);
    }
  }

  private updateJumpMotion(nowMs: number) {
    const targetLift = this.jumpAvailable ? TILE_JUMP_LIFT_PX : 0;
    this.jumpLift += (targetLift - this.jumpLift) * TILE_JUMP_LIFT_EASE;
    const wobble = this.jumpAvailable
      ? Math.sin(nowMs * TILE_JUMP_WOBBLE_FREQUENCY) * TILE_JUMP_WOBBLE_AMPLITUDE_PX
      : 0;
    this.visual.y = -this.jumpLift + wobble;
    const liftedHeight = Math.max(0, -this.visual.y);
    const brightnessProgress = Math.min(1, liftedHeight / (TILE_JUMP_LIFT_PX + TILE_JUMP_WOBBLE_AMPLITUDE_PX));
    this.brightnessFilter.brightness(1 + TILE_JUMP_BRIGHTNESS_BOOST * brightnessProgress, false);
    if (!this.jumpAvailable && Math.abs(this.visual.y) < 0.05) {
      this.visual.y = 0;
      this.brightnessFilter.brightness(1, false);
    }
  }
}

export const createBoardTile = (unpaintedTexture: Texture, paintedTexture: Texture, gx: number, gy: number) => {
  return new BoardTileView(unpaintedTexture, paintedTexture, gx, gy);
};

export const addBoardTilesInIsoOrder = (
  createTile: (gx: number, gy: number) => BoardTileView,
  addTile: (tile: BoardTileView) => void,
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
  sprite.tint = 0xffffff;

  return { shadow, aura, sprite, bodyBaseScale: s };
};

export const placeCharacterView = (
  view: CharacterView,
  gx: number,
  gy: number,
  jumpOffset = 0,
  shadowScale = 1,
  bodyScale: { x: number; y: number } = { x: 1, y: 1 },
) => {
  const p = isoPos(gx, gy);
  view.sprite.x = p.x;
  view.sprite.y = p.y + jumpOffset;
  view.sprite.zIndex = isoDepth(gx, gy, DEPTH_OFFSETS.CHARACTER_BODY);
  view.sprite.scale.set(view.bodyBaseScale * bodyScale.x, view.bodyBaseScale * bodyScale.y);
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

export const createBombWarningSprite = (
  texture: Texture,
  gx: number,
  gy: number,
  anchor = { x: BOMB_WARNING_ANCHOR_X, y: BOMB_WARNING_ANCHOR_Y },
) => {
  const p = isoPos(gx, gy);
  const warning = new Sprite(texture);
  warning.label = "bomb-warning";
  warning.anchor.set(anchor.x, anchor.y);
  warning.scale.set(BOMB_TARGET_H / Math.max(texture.frame.height, 1));
  warning.x = p.x;
  warning.y = p.y;
  warning.zIndex = isoDepth(gx, gy, DEPTH_OFFSETS.BOMB_WARNING);
  return warning;
};

export const updateBombWarningSprite = (
  warning: Sprite,
  texture: Texture,
  anchor = { x: BOMB_WARNING_ANCHOR_X, y: BOMB_WARNING_ANCHOR_Y },
) => {
  warning.texture = texture;
  warning.anchor.set(anchor.x, anchor.y);
  warning.scale.set(BOMB_TARGET_H / Math.max(texture.frame.height, 1));
};

export const createBootsSprite = (texture: Texture, gx: number, gy: number) => {
  const gfx = new Sprite(texture);
  gfx.label = "boots";
  gfx.anchor.set(0.5, 0.5);
  const targetH = 70;
  const s = targetH / Math.max(texture.height, 1);
  gfx.scale.set(s);
  placeBootsSprite(gfx, gx, gy);
  return gfx;
};

export const placeBootsSprite = (sprite: Sprite, gx: number, gy: number) => {
  const p = isoPos(gx, gy);
  sprite.x = p.x;
  sprite.y = p.y + BOOTS_Y_OFFSET;
  sprite.zIndex = isoDepth(gx, gy, DEPTH_OFFSETS.BOOTS);
};

export const createArrowGraphic = (gx: number, gy: number, dir = 0) => {
  const gfx = new Graphics({ label: "rotating-arrow" });
  // Graphics has no anchor. Keep all arrow geometry centered on local (0, 0),
  // then place that origin at the exact tile center.
  gfx.circle(0, 0, 26).stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
  gfx
    .poly([0, -22, 14, 0, 6, 0, 6, 22, -6, 22, -6, 0, -14, 0])
    .fill(0xffffff)
    .stroke({ width: 2, color: 0x222222 });
  setArrowDirection(gfx, dir);
  placeArrowGraphic(gfx, gx, gy);
  return gfx;
};

export const placeArrowGraphic = (gfx: Graphics, gx: number, gy: number) => {
  const p = isoPos(gx, gy);
  gfx.x = p.x;
  gfx.y = p.y + ARROW_Y_OFFSET;
  gfx.zIndex = isoDepth(gx, gy, DEPTH_OFFSETS.ARROW);
};

export const setArrowDirection = (gfx: Graphics, dir: number) => {
  gfx.rotation = isoRotation(dir);
};
