import { Container, Graphics } from "pixi.js";

export interface JoystickView {
  container: Container;
  base: Graphics;
  knob: Graphics;
}

export const createJoystickView = (parent: Container): JoystickView => {
  const container = new Container({ label: "joystick" });
  container.visible = false;
  container.scale.y = 0.5;
  parent.addChild(container);

  const base = new Graphics({ label: "joystick-base" });
  base.circle(0, 0, 50).fill({ color: 0x3a1f10, alpha: 0.35 });
  container.addChild(base);

  const knob = new Graphics({ label: "joystick-knob" });
  knob.circle(0, 0, 25).fill({ color: 0xfff2e0, alpha: 0.85 });
  container.addChild(knob);

  return { container, base, knob };
};
