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
export type BotStrategyId = "chest" | "paint";
// Strategy assignment by active bot slot. Override per skin below for hand-tuned setups.
export const BOT_STRATEGY_BY_SLOT: BotStrategyId[] = ["chest", "paint", "chest"];
export const BOT_STRATEGY_BY_SKIN_OVERRIDE: Partial<Record<SkinId, BotStrategyId>> = {};

export const zeroScores = (): Record<SkinId, number> => ({
  plush: 0,
  banana: 0,
  dragon: 0,
  cat: 0,
});

export const MAX_LEVEL = 10;
export const WINS_TO_PASS = 3;
export const BOMB_UNLOCK_LEVEL = 1;
export const BOOTS_UNLOCK_LEVEL = 2;
export const ARROW_UNLOCK_LEVEL = 3;
export const isBombUnlocked = (level: number, round: number) =>
  level > BOMB_UNLOCK_LEVEL || (level === BOMB_UNLOCK_LEVEL && round >= 2);
export const isBootsUnlocked = (level: number) => level >= BOOTS_UNLOCK_LEVEL;
export const isArrowUnlocked = (level: number) => level >= ARROW_UNLOCK_LEVEL;
export const botsForRound = (level: number, round: number) => {
  if (level < 4) return level === 1 && round < 3 ? 1 : 2;
  return 3;
};
export const botsForLevel = (level: number) => botsForRound(level, Number.POSITIVE_INFINITY);
export const roundDurationForLevel = (lv: number) =>
  lv <= 2 ? 30 : lv <= 4 ? 45 : lv <= 6 ? 60 : lv <= 8 ? 75 : 90;

export const ENEMY_SPAWN_POSITIONS: Array<[number, number]> = [
  [7, 7],
  [7, 0],
  [0, 7],
  [4, 4],
];

export const BASE_JUMP_DURATION = 200;
export const BOOST_SPEED_MULTIPLIER = 1.5;
export const BOOST_JUMP_DURATION = BASE_JUMP_DURATION / BOOST_SPEED_MULTIPLIER;
export const STUN_DURATION = 3000;
export const BOOST_DURATION = 12000;
export const BOOTS_RESPAWN_MIN_MS = 2500;
export const BOOTS_RESPAWN_MAX_MS = 3750;
export const ARROW_RESPAWN_MS = 20000 / 3;
export const BOT_TARGET_REACTION_DELAY_MIN_MS = 400;
export const BOT_TARGET_REACTION_MAX_MS = 2000;
export const botTargetReactionDelayForLevel = (lv: number) => {
  const t = Math.min(1, Math.max(0, (lv - 1) / (MAX_LEVEL - 1)));
  return Math.round(
    BOT_TARGET_REACTION_MAX_MS + (BOT_TARGET_REACTION_DELAY_MIN_MS - BOT_TARGET_REACTION_MAX_MS) * t,
  );
};
export const BOT_SUBOPTIMAL_ROUTE_CHANCE = 0.2;
export const botSuboptimalRouteChance = (level: number, round: number) => {
  if (level !== 1) return BOT_SUBOPTIMAL_ROUTE_CHANCE;
  return Math.min(1, BOT_SUBOPTIMAL_ROUTE_CHANCE * (round <= 2 ? 3 : 2));
};
export const BOT_SUBOPTIMAL_ROUTE_MIN_EXTRA_STEPS = 1;
export const BOT_SUBOPTIMAL_ROUTE_MAX_EXTRA_STEPS = 2;
export const BOT_BOOTS_DISTANCE_RATIO = 0.65;
// Paint strategy starts when the bot's chest distance is at least this multiple of the nearest
// rival character's (the player or another bot).
export const BOT_PAINT_STRATEGY_CHEST_DISTANCE_RATIO = 1.2;
export const DIRECTIONS: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];

export const LS_UNLOCKED = "iso_unlocked_level";
export const LS_FIRST_LAUNCH_DONE = "isogrid:first-launch-done:v1";
export const LS_GAMEPLAY_TUTORIAL_SEEN = "isogrid:gameplay-tutorial:v1";

export interface RoundHistoryEntry {
  level: number;
  round: number;
  winner: SkinId | null;
  scores: Record<SkinId, number>;
}
