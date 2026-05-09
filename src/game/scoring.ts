import { BOARD_SIZE, SKIN_IDS, type SkinId, zeroScores } from "@/game/game-constants";

export type OwnerGrid = (SkinId | null)[][];

export const countOwned = (owners: OwnerGrid, skinId: SkinId) => {
  let n = 0;
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (owners[x][y] === skinId) n++;
    }
  }
  return n;
};

export const scoreOwners = (owners: OwnerGrid) => {
  const next = zeroScores();
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      const owner = owners[x][y];
      if (owner) next[owner]++;
    }
  }
  return next;
};

export const scoresChanged = (
  prev: Record<SkinId, number>,
  next: Record<SkinId, number>,
) => SKIN_IDS.some((id) => prev[id] !== next[id]);
