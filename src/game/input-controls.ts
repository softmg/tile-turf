import type { Direction } from "@/game/game-constants";

export const JOYSTICK_MAX_RADIUS = 40;
export const JOYSTICK_DEADZONE = JOYSTICK_MAX_RADIUS * 0.25;
export const JOYSTICK_SNAP_ANGLE = Math.PI / 6;
export const JOYSTICK_MOVE_COOLDOWN_MS = 200;

export interface JoystickDragVector {
  clampedDistance: number;
  knobAngle: number;
  direction: Direction | null;
}

const JOYSTICK_DIRECTION_ANGLES: Record<Direction, number> = {
  UP: -Math.PI / 4,
  RIGHT: Math.PI / 4,
  DOWN: (3 * Math.PI) / 4,
  LEFT: (-3 * Math.PI) / 4,
};

export const directionFromKeyboardKey = (key: string): Direction | null => {
  switch (key) {
    case "ArrowUp":
    case "KeyW":
    case "w":
    case "W":
      return "UP";
    case "ArrowDown":
    case "KeyS":
    case "s":
    case "S":
      return "DOWN";
    case "ArrowLeft":
    case "KeyA":
    case "a":
    case "A":
      return "LEFT";
    case "ArrowRight":
    case "KeyD":
    case "d":
    case "D":
      return "RIGHT";
    default:
      return null;
  }
};

const directionFromKeyboardEvent = (e: KeyboardEvent): Direction | null =>
  directionFromKeyboardKey(e.code) ?? directionFromKeyboardKey(e.key);

export const createKeyboardMovementController = ({
  isBlocked,
  move,
}: {
  isBlocked: () => boolean;
  move: (direction: Direction) => void;
}) => {
  const keysDown = new Set<string>();
  const keyOrder: string[] = [];

  const reset = () => {
    keysDown.clear();
    keyOrder.length = 0;
  };

  const activeDirection = () => {
    for (let i = keyOrder.length - 1; i >= 0; i--) {
      const code = keyOrder[i];
      if (!keysDown.has(code)) continue;
      const direction = directionFromKeyboardKey(code);
      if (direction) return direction;
    }
    return null;
  };

  const advance = () => {
    if (isBlocked()) {
      reset();
      return;
    }
    const direction = activeDirection();
    if (direction) move(direction);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const direction = directionFromKeyboardEvent(e);
    if (!direction) return;
    e.preventDefault();

    const code = e.code || e.key;
    if (!keysDown.has(code)) {
      keysDown.add(code);
      keyOrder.push(code);
    }
    advance();
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    const direction = directionFromKeyboardEvent(e);
    if (!direction) return;
    e.preventDefault();

    const code = e.code || e.key;
    keysDown.delete(code);
    const index = keyOrder.indexOf(code);
    if (index >= 0) keyOrder.splice(index, 1);
  };

  return { advance, handleKeyDown, handleKeyUp, reset };
};

const directionFromJoystickAngle = (angle: number): Direction => {
  const deg = (angle * 180) / Math.PI;
  if (deg >= -90 && deg < 0) return "UP";
  if (deg >= 0 && deg < 90) return "RIGHT";
  if (deg >= 90 && deg <= 180) return "DOWN";
  return "LEFT";
};

const angleDistance = (a: number, b: number) => {
  const diff = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(diff, Math.PI * 2 - diff);
};

const snappedJoystickDirection = (angle: number) => {
  const direction = directionFromJoystickAngle(angle);
  const snapAngle = JOYSTICK_DIRECTION_ANGLES[direction];
  return angleDistance(angle, snapAngle) <= JOYSTICK_SNAP_ANGLE
    ? { direction, angle: snapAngle }
    : { direction, angle };
};

export const joystickDragVector = (dx: number, dy: number): JoystickDragVector => {
  const distance = Math.hypot(dx, dy);
  const clampedDistance = Math.min(distance, JOYSTICK_MAX_RADIUS);
  const angle = Math.atan2(dy, dx);
  const snapped = snappedJoystickDirection(angle);

  return {
    clampedDistance,
    knobAngle: distance < JOYSTICK_DEADZONE ? angle : snapped.angle,
    direction: distance < JOYSTICK_DEADZONE ? null : snapped.direction,
  };
};
