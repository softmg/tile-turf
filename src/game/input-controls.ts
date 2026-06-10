import type { Direction } from "@/game/game-constants";

export const AUTO_MOVE_COOLDOWN_MS = 200;

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

export const directionFromKeyboardEvent = (e: KeyboardEvent): Direction | null =>
  directionFromKeyboardKey(e.code) ?? directionFromKeyboardKey(e.key);
