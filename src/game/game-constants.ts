import tileUrl from "@/assets/tile-front.webp";
import tilePaintedUrl from "@/assets/tile-front-painted.webp";
import playerUrl from "@/assets/player.webp";
import backgroundUrl from "@/assets/background.webp";

export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export const BOARD_SIZE = 8;
export const TILE_W = 110;
export const TILE_H = 70;
export const TILE_SIZE = 120;
export const TILE_STEP_X = 100;
export const TILE_STEP_Y = 82;

export type SkinId = "plush" | "girl" | "alien" | "knight" | "robot";

export interface SkinConfig {
  id: SkinId;
  name: string;
  playerSprite: string;
  tileSprite: string;
  minimapColor: number;
  uiColor: string;
  spriteTint: number;
}

export const SKINS: Record<SkinId, SkinConfig> = {
  plush: {
    id: "plush",
    name: "Plush",
    playerSprite: playerUrl,
    tileSprite: tilePaintedUrl,
    minimapColor: 0xe89a6a,
    uiColor: "#e89a6a",
    spriteTint: 0xffffff,
  },
  girl: {
    id: "girl",
    name: "Girl",
    playerSprite: playerUrl,
    tileSprite: tilePaintedUrl,
    minimapColor: 0xff7fb3,
    uiColor: "#ff7fb3",
    spriteTint: 0xffb6d4,
  },
  alien: {
    id: "alien",
    name: "Alien",
    playerSprite: playerUrl,
    tileSprite: tilePaintedUrl,
    minimapColor: 0x6ed36e,
    uiColor: "#6ed36e",
    spriteTint: 0xb8f2b8,
  },
  knight: {
    id: "knight",
    name: "Knight",
    playerSprite: playerUrl,
    tileSprite: tilePaintedUrl,
    minimapColor: 0x9aa6b8,
    uiColor: "#9aa6b8",
    spriteTint: 0xd0d8e4,
  },
  robot: {
    id: "robot",
    name: "Robot",
    playerSprite: playerUrl,
    tileSprite: tilePaintedUrl,
    minimapColor: 0x9b87f5,
    uiColor: "#9b87f5",
    spriteTint: 0xc4b4ff,
  },
};

export const BACKGROUND_URL = backgroundUrl;
export const UNPAINTED_TILE_URL = tileUrl;
export const PAINTED_TILE_URL = tilePaintedUrl;
export const PLAYER_URL = playerUrl;
export const UNPAINTED_MINIMAP_COLOR = 0xf5d0b0;

export const PLAYER_SKIN: SkinId = "plush";
export const BOT_SKINS: SkinId[] = ["girl", "alien", "knight", "robot"];
export const SKIN_IDS: SkinId[] = ["plush", "girl", "alien", "knight", "robot"];

export const zeroScores = (): Record<SkinId, number> => ({
  plush: 0,
  girl: 0,
  alien: 0,
  knight: 0,
  robot: 0,
});

export const MAX_LEVEL = 10;
export const WINS_TO_PASS = 3;
export const botsForLevel = (lv: number) => (lv <= 2 ? 1 : lv <= 4 ? 2 : lv <= 7 ? 3 : 4);
export const enemyIntervalForLevel = (lv: number) => Math.max(220, 750 - (lv - 1) * 60);
export const roundDurationForLevel = (lv: number) =>
  lv <= 2 ? 30 : lv <= 4 ? 45 : lv <= 6 ? 60 : lv <= 8 ? 75 : 90;

export const ENEMY_SPAWN_POSITIONS: Array<[number, number]> = [
  [7, 7],
  [7, 0],
  [0, 7],
  [4, 4],
];

export const BASE_JUMP_DURATION = 380;
export const BOOST_JUMP_DURATION = 150;
export const STUN_DURATION = 2000;
export const BOOST_DURATION = 12000;
export const DIRECTIONS: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];

export const LS_UNLOCKED = "iso_unlocked_level";
export const LS_TUTORIAL_SEEN = "isogrid:tutorial:v1";

export interface RoundHistoryEntry {
  level: number;
  round: number;
  winner: SkinId | null;
  scores: Record<SkinId, number>;
}
