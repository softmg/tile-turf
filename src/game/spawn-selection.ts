import { BOARD_SIZE } from "@/game/game-constants";
import type { GridPosition } from "@/game/grid-math";
import { manhattanDistance } from "@/game/grid-math";
import type { SeededRng } from "@/game/rng";

export interface FairSpawnOptions {
  characters: GridPosition[];
  minDistance: number;
  maxDistanceDelta: number;
  rng: SeededRng;
  boardSize?: number;
}

export const unoccupiedCells = (
  characters: GridPosition[],
  boardSize = BOARD_SIZE,
): GridPosition[] => {
  const cells: GridPosition[] = [];
  for (let gx = 0; gx < boardSize; gx++) {
    for (let gy = 0; gy < boardSize; gy++) {
      if (!characters.some((character) => character.gx === gx && character.gy === gy)) {
        cells.push({ gx, gy });
      }
    }
  }
  return cells;
};

export const chooseFairSpawnCell = ({
  characters,
  minDistance,
  maxDistanceDelta,
  rng,
  boardSize = BOARD_SIZE,
}: FairSpawnOptions): GridPosition => {
  const randomCell = () => ({ gx: rng.int(boardSize), gy: rng.int(boardSize) });
  const availableCells = unoccupiedCells(characters, boardSize);
  const randomUnoccupiedCell = () =>
    availableCells.length > 0 ? availableCells[rng.int(availableCells.length)] : randomCell();

  if (characters.length <= 1) return randomUnoccupiedCell();

  const distantCandidates: GridPosition[] = [];
  const fairCandidates: GridPosition[] = [];
  for (const cell of availableCells) {
    let nearestDistance = Infinity;
    let farthestDistance = -Infinity;
    for (const character of characters) {
      const distance = manhattanDistance(character, cell);
      nearestDistance = Math.min(nearestDistance, distance);
      farthestDistance = Math.max(farthestDistance, distance);
    }
    if (nearestDistance < minDistance) continue;

    distantCandidates.push(cell);
    if (farthestDistance - nearestDistance <= maxDistanceDelta) fairCandidates.push(cell);
  }

  if (fairCandidates.length > 0) return fairCandidates[rng.int(fairCandidates.length)];
  return distantCandidates.length > 0
    ? distantCandidates[rng.int(distantCandidates.length)]
    : randomUnoccupiedCell();
};
