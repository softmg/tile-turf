import { LS_TUTORIAL_SEEN, LS_UNLOCKED, MAX_LEVEL } from "@/game/game-constants";

export const clampUnlockedLevel = (value: number) =>
  Math.min(MAX_LEVEL, Math.max(1, Number.isFinite(value) ? value : 1));

export const readUnlockedLevel = (storage: Storage) => {
  const value = parseInt(storage.getItem(LS_UNLOCKED) || "1", 10);
  return clampUnlockedLevel(value);
};

export const writeUnlockedLevel = (storage: Storage, level: number) => {
  storage.setItem(LS_UNLOCKED, String(clampUnlockedLevel(level)));
};

export const shouldShowTutorial = (storage: Storage) => storage.getItem(LS_TUTORIAL_SEEN) !== "1";

export const markTutorialSeen = (storage: Storage) => {
  storage.setItem(LS_TUTORIAL_SEEN, "1");
};
