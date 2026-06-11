import { Container, type Application } from "pixi.js";

export interface SceneLayers {
  world: Container;
  boardLayer: Container;
  depthLayer: Container;
  minimapLayer: Container;
}

export const DEPTH_OFFSETS = {
  TILE_BASE: 0,
  CHARACTER_SHADOW: 0.05,
  CHEST: 0.05,
  BOMB_WARNING: 0.06,
  BOOTS: 0.06,
  CHARACTER_BODY: 0.1,
  ARROW: 0.1,
  BOMB_EXPLOSION: 0.5,
} as const;

export const isoDepth = (gx: number, gy: number, offset: number = DEPTH_OFFSETS.TILE_BASE) =>
  gx + gy + offset;

export const createSceneLayers = (app: Application): SceneLayers => {
  const world = new Container({ label: "world" });
  const boardLayer = new Container({
    label: "board-layer",
    sortableChildren: false,
  });
  const depthLayer = new Container({
    label: "depth-layer",
    sortableChildren: true,
  });
  const minimapLayer = new Container({ label: "minimap-layer" });

  world.addChild(boardLayer, depthLayer);
  app.stage.addChild(world, minimapLayer);

  return {
    world,
    boardLayer,
    depthLayer,
    minimapLayer,
  };
};

export const removeAndDestroy = <T extends Container>(node: T | null | undefined) => {
  if (!node) return;
  const state = node as T & { destroyed?: boolean };
  if (state.destroyed) return;
  node.parent?.removeChild(node);
  node.destroy({ children: true });
};
