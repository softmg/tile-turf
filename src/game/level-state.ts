import { LS_GAMEPLAY_TUTORIAL_SEEN, LS_UNLOCKED, MAX_LEVEL } from "@/game/game-constants";

export const clampUnlockedLevel = (value: number) =>
  Math.min(MAX_LEVEL, Math.max(1, Number.isFinite(value) ? value : 1));

export const readUnlockedLevel = (storage: Storage) => {
  const value = parseInt(storage.getItem(LS_UNLOCKED) || "1", 10);
  return clampUnlockedLevel(value);
};

export const writeUnlockedLevel = (storage: Storage, level: number) => {
  storage.setItem(LS_UNLOCKED, String(clampUnlockedLevel(level)));
};

export const readGameplayTutorialSeenSteps = (storage: Storage) =>
  new Set(
    (storage.getItem(LS_GAMEPLAY_TUTORIAL_SEEN) || "")
      .split(",")
      .map((step) => step.trim())
      .filter(Boolean),
  );

export const markGameplayTutorialStepSeen = (storage: Storage, step: string) => {
  const steps = readGameplayTutorialSeenSteps(storage);
  steps.add(step);
  storage.setItem(LS_GAMEPLAY_TUTORIAL_SEEN, Array.from(steps).join(","));
};
