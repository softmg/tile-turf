import {
  BOARD_SIZE,
  BOT_BOOTS_DISTANCE_RATIO,
  BOT_PAINT_STRATEGY_CHEST_DISTANCE_RATIO,
  BOT_SUBOPTIMAL_ROUTE_MAX_EXTRA_STEPS,
  BOT_SUBOPTIMAL_ROUTE_MIN_EXTRA_STEPS,
  DIRECTIONS,
  SKIN_IDS,
  type BotStrategyId,
  type Direction,
  type SkinId,
} from "@/game/game-constants";
import {
  isInsideBoard,
  manhattanDistance,
  nextGridPosition,
  type GridPosition,
} from "@/game/grid-math";
import type { SeededRng } from "@/game/rng";
import { countOwned, type OwnerGrid } from "@/game/scoring";

export interface BotState extends GridPosition {
  skinId: SkinId;
  boostUntil: number;
}

export interface BotRoutePlan {
  target: GridPosition;
  targetKey: string;
  waypoint: GridPosition | null;
}

export interface ChooseBotMoveOptions {
  bot: BotState;
  rivals: GridPosition[];
  strategy: BotStrategyId;
  chest: GridPosition;
  boots: GridPosition | null;
  owners: OwnerGrid;
  warningBombs: GridPosition[];
  previousPlan?: BotRoutePlan;
  targetReactionUntil: number;
  nowMs: number;
  suboptimalRouteChance: number;
  rng: SeededRng;
}

export interface BotMoveDecision {
  direction: Direction;
  routePlan: BotRoutePlan;
}

export const currentPaintLeaderFor = (owners: OwnerGrid, skinId: SkinId): SkinId | null => {
  let leader: SkinId | null = null;
  let leaderScore = -1;
  for (const id of SKIN_IDS) {
    if (id === skinId) continue;
    const score = countOwned(owners, id);
    if (score > leaderScore) {
      leader = id;
      leaderScore = score;
    }
  }
  return leader;
};

export const nearestPaintTargetFor = (
  owners: OwnerGrid,
  bot: Pick<BotState, "gx" | "gy" | "skinId">,
): GridPosition => {
  const leader = currentPaintLeaderFor(owners, bot.skinId);
  const currentPosition = { gx: bot.gx, gy: bot.gy };
  let best: GridPosition | null = null;
  let bestDistance = Infinity;
  let bestIsLeaderOwned = false;

  for (let gx = 0; gx < BOARD_SIZE; gx++) {
    for (let gy = 0; gy < BOARD_SIZE; gy++) {
      const owner = owners[gx][gy];
      if (owner === bot.skinId) continue;
      const distance = manhattanDistance(currentPosition, { gx, gy });
      const isLeaderOwned = owner === leader;
      if (
        distance < bestDistance ||
        (distance === bestDistance && isLeaderOwned && !bestIsLeaderOwned)
      ) {
        best = { gx, gy };
        bestDistance = distance;
        bestIsLeaderOwned = isLeaderOwned;
      }
    }
  }

  return best ?? currentPosition;
};

const isInBombArea = (position: GridPosition, bomb: GridPosition) =>
  Math.abs(position.gx - bomb.gx) <= 1 && Math.abs(position.gy - bomb.gy) <= 1;

export const chooseBotMove = ({
  bot,
  rivals,
  strategy,
  chest,
  boots,
  owners,
  warningBombs,
  previousPlan,
  targetReactionUntil,
  nowMs,
  suboptimalRouteChance,
  rng,
}: ChooseBotMoveOptions): BotMoveDecision | null => {
  const directions = DIRECTIONS.map((direction) => ({
    direction,
    next: nextGridPosition(bot.gx, bot.gy, direction),
  })).filter(({ next }) => isInsideBoard(next.gx, next.gy));
  if (directions.length === 0) return null;

  const currentPosition = { gx: bot.gx, gy: bot.gy };
  const isInAnyBombArea = (position: GridPosition) =>
    warningBombs.some((bomb) => isInBombArea(position, bomb));
  const nonWarningDirections = directions.filter(
    ({ next }) => !warningBombs.some((bomb) => bomb.gx === next.gx && bomb.gy === next.gy),
  );
  const currentInBombArea = isInAnyBombArea(currentPosition);
  const nonBombAreaDirections = nonWarningDirections.filter(({ next }) => !isInAnyBombArea(next));
  const options =
    nonBombAreaDirections.length > 0
      ? nonBombAreaDirections
      : nonWarningDirections.length > 0
        ? nonWarningDirections
        : directions;

  const chestDistance = manhattanDistance(currentPosition, chest);
  const nearestRivalChestDistance = rivals.reduce(
    (best, rival) => Math.min(best, manhattanDistance(rival, chest)),
    Infinity,
  );
  const shouldPaint =
    strategy === "paint" &&
    chestDistance >= nearestRivalChestDistance * BOT_PAINT_STRATEGY_CHEST_DISTANCE_RATIO;
  const directTarget = shouldPaint
    ? nearestPaintTargetFor(owners, bot)
    : !currentInBombArea &&
        boots &&
        nowMs >= bot.boostUntil &&
        manhattanDistance(currentPosition, boots) <= chestDistance * BOT_BOOTS_DISTANCE_RATIO
      ? boots
      : chest;
  const targetKind = shouldPaint ? "paint" : directTarget === boots ? "boots" : "chest";
  const targetKey = `${targetKind}:${directTarget.gx},${directTarget.gy}`;
  let routePlan = previousPlan
    ? {
        target: { ...previousPlan.target },
        targetKey: previousPlan.targetKey,
        waypoint: previousPlan.waypoint ? { ...previousPlan.waypoint } : null,
      }
    : undefined;
  const targetReached = routePlan?.target.gx === bot.gx && routePlan.target.gy === bot.gy;
  const keepPreviousTarget = Boolean(
    routePlan &&
    routePlan.targetKey !== targetKey &&
    !targetReached &&
    !currentInBombArea &&
    nowMs < targetReactionUntil,
  );
  const routeTarget = keepPreviousTarget && routePlan ? routePlan.target : directTarget;

  if (!routePlan || targetReached || (!keepPreviousTarget && routePlan.targetKey !== targetKey)) {
    const directDistance = manhattanDistance(currentPosition, routeTarget);
    const waypointCandidates: GridPosition[] = [];
    if (!currentInBombArea && rng.next() < suboptimalRouteChance) {
      for (let gx = 0; gx < BOARD_SIZE; gx++) {
        for (let gy = 0; gy < BOARD_SIZE; gy++) {
          if (
            (gx === bot.gx && gy === bot.gy) ||
            (gx === routeTarget.gx && gy === routeTarget.gy)
          ) {
            continue;
          }
          const waypoint = { gx, gy };
          const extraSteps =
            manhattanDistance(currentPosition, waypoint) +
            manhattanDistance(waypoint, routeTarget) -
            directDistance;
          if (
            extraSteps >= BOT_SUBOPTIMAL_ROUTE_MIN_EXTRA_STEPS &&
            extraSteps <= BOT_SUBOPTIMAL_ROUTE_MAX_EXTRA_STEPS
          ) {
            waypointCandidates.push(waypoint);
          }
        }
      }
    }
    routePlan = {
      target: { ...routeTarget },
      targetKey,
      waypoint: waypointCandidates.length > 0 ? rng.pick(waypointCandidates) : null,
    };
  }

  if (
    routePlan.waypoint &&
    ((routePlan.waypoint.gx === bot.gx && routePlan.waypoint.gy === bot.gy) ||
      isInAnyBombArea(routePlan.waypoint))
  ) {
    routePlan.waypoint = null;
  }
  const target = !currentInBombArea && routePlan.waypoint ? routePlan.waypoint : routePlan.target;
  const ranked = [...options].sort(
    (a, b) => manhattanDistance(a.next, target) - manhattanDistance(b.next, target),
  );

  return { direction: ranked[0].direction, routePlan };
};
