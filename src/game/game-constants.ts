import tileUrl from "@/assets/tile.webp";
import tilePaintedUrl from "@/assets/tile-painted.webp";
import playerUrl from "@/assets/player.webp";
import backgroundUrl from "@/assets/background.webp";
import bananaUrl from "@/assets/bots/webp/banana.webp";
import catUrl from "@/assets/bots/webp/cat.webp";
import dragonUrl from "@/assets/bots/webp/dragon.webp";

export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export const BOARD_SIZE = 8;
export const TILE_W = 110;
export const TILE_H = 70;
export const TILE_SIZE = 120;

export type SkinId = "plush" | "banana" | "dragon" | "cat";

export interface SkinConfig {
  id: SkinId;
  name: string;
  playerSprite: string;
  tileSprite: string;
  minimapColor: number;
  uiColor: string;
  paintTint: number;
}

export const SKINS: Record<SkinId, SkinConfig> = {
  plush: {
    id: "plush",
    name: "Plush",
    playerSprite: playerUrl,
    tileSprite: tilePaintedUrl,
    minimapColor: 0xffb6d4,
    uiColor: "#ffb6d4",
    paintTint: 0xffb6d4,
  },
  banana: {
    id: "banana",
    name: "Banana",
    playerSprite: bananaUrl,
    tileSprite: tilePaintedUrl,
    minimapColor: 0xffff00,
    uiColor: "#f3d439",
    paintTint: 0xffff00,
  },
  dragon: {
    id: "dragon",
    name: "Dragon",
    playerSprite: dragonUrl,
    tileSprite: tilePaintedUrl,
    minimapColor: 0x2ecc71,
    uiColor: "#2ecc71",
    paintTint: 0x2ecc71,
  },
  cat: {
    id: "cat",
    name: "Cat",
    playerSprite: catUrl,
    tileSprite: tilePaintedUrl,
    minimapColor: 0x8a5a44,
    uiColor: "#8a5a44",
    paintTint: 0x8a5a44,
  },
};

export const BACKGROUND_URL = backgroundUrl;
export const UNPAINTED_TILE_URL = tileUrl;
export const PAINTED_TILE_URL = tilePaintedUrl;
export const PLAYER_URL = playerUrl;
export const UNPAINTED_MINIMAP_COLOR = 0xf5d0b0;

export const PLAYER_SKIN: SkinId = "plush";
export const BOT_SKINS: SkinId[] = ["banana", "dragon", "cat"];
export const SKIN_IDS: SkinId[] = ["plush", "banana", "dragon", "cat"];

export const zeroScores = (): Record<SkinId, number> => ({
  plush: 0,
  banana: 0,
  dragon: 0,
  cat: 0,
});

export const MAX_LEVEL = 10;
export const WINS_TO_PASS = 3;
export const BOMB_UNLOCK_LEVEL = 2;
export const BOOTS_UNLOCK_LEVEL = 3;
export const ARROW_UNLOCK_LEVEL = 4;
export const botsForLevel = (lv: number) => (lv <= 2 ? 1 : lv <= 4 ? 2 : 3);
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
export const STUN_DURATION = 3000;
export const BOOST_DURATION = 12000;
export const DIRECTIONS: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];

export const LS_UNLOCKED = "iso_unlocked_level";
export const LS_GAMEPLAY_TUTORIAL_SEEN = "isogrid:gameplay-tutorial:v1";

export interface RoundHistoryEntry {
  level: number;
  round: number;
  winner: SkinId | null;
  scores: Record<SkinId, number>;
}
