# Animal Crossing Inspired Design System

## Codex Ready Specification

This document is intended as a machine-readable source for AI-assisted UI generation.

---

# Design Philosophy

Generate interfaces that are:

- Friendly
- Cozy
- Rounded
- Low contrast
- Highly accessible
- Touch friendly
- Nintendo-like
- Minimal visual noise

Avoid:

- Sharp corners
- Dark themes
- Heavy shadows
- Aggressive gradients
- Thin clickable targets

---

# Design Tokens

## Colors

```json
{
  "color.background.primary": "#F4F0E4",
  "color.background.secondary": "#FAF8F1",
  "color.background.tertiary": "#E8DFC7",

  "color.text.primary": "#5F584B",
  "color.text.secondary": "#A29684",
  "color.text.inverse": "#FFFFFF",

  "color.accent.primary": "#63B7F5",
  "color.accent.success": "#A9D9A0",
  "color.accent.reward": "#C9D95A",
  "color.accent.warning": "#E7A15A",
  "color.accent.error": "#E57B70",

  "color.overlay.dark": "rgba(35,25,15,0.82)"
}
```

---

## Radius

```json
{
  "radius.xs": 12,
  "radius.sm": 20,
  "radius.md": 32,
  "radius.lg": 48,
  "radius.xl": 64
}
```

---

## Spacing

```json
{
  "space.1": 8,
  "space.2": 16,
  "space.3": 24,
  "space.4": 32,
  "space.5": 48,
  "space.6": 64
}
```

---

## Typography

```json
{
  "font.family": "Nunito",

  "font.h1.size": 40,
  "font.h1.weight": 700,

  "font.h2.size": 32,
  "font.h2.weight": 700,

  "font.body.large.size": 26,
  "font.body.large.weight": 600,

  "font.body.size": 22,
  "font.body.weight": 500,

  "font.caption.size": 18,
  "font.caption.weight": 500
}
```

---

# Layout Rules

Base grid:

```text
8px
```

Rules:

- All spacing must use token values.
- Minimum touch target: 48x48.
- Prefer 64x64.
- Use large empty space.
- Avoid dense layouts.
- Main window padding: 32.
- Dialog padding: 40.

---

# Component Specification

## Button

Variants:

- Primary
- Secondary
- Success
- Warning

States:

- Default
- Hover
- Pressed
- Disabled

Style:

```json
{
  "radius": 20,
  "paddingX": 24,
  "paddingY": 16
}
```

---

## Window

Structure:

```text
Window
 ├ Header
 ├ Content
 └ Footer
```

Style:

```json
{
  "background": "color.background.primary",
  "radius": 48,
  "padding": 32
}
```

---

## Dialog

Structure:

```text
Dialog
 ├ Speaker
 ├ Title
 ├ Content
 └ Actions
```

Style:

```json
{
  "radius": 64,
  "padding": 40
}
```

---

## InventorySlot

Properties:

```ts
interface InventorySlot {
  icon: string;
  amount?: number;
  selected?: boolean;
  disabled?: boolean;
}
```

Style:

```json
{
  "size": 96,
  "radius": 32
}
```

---

## CurrencyBadge

Properties:

```ts
interface CurrencyBadge {
  icon: string;
  amount: number;
}
```

---

## RewardCard

Properties:

```ts
interface RewardCard {
  icon: string;
  progress: number;
  progressMax: number;
  reward: number;
}
```

---

## ControllerHint

Properties:

```ts
interface ControllerHint {
  button: string;
  label: string;
}
```

---

# Figma Variables

## Collection: Colors

- Background / Primary
- Background / Secondary
- Background / Tertiary
- Text / Primary
- Text / Secondary
- Accent / Primary
- Accent / Success
- Accent / Reward
- Accent / Warning
- Accent / Error

---

## Collection: Radius

- XS
- SM
- MD
- LG
- XL

---

## Collection: Spacing

- 8
- 16
- 24
- 32
- 48
- 64

---

## Collection: Typography

- H1
- H2
- Body Large
- Body
- Caption

---

# Figma Components

## Foundation

- Color Tokens
- Typography Tokens
- Radius Tokens
- Spacing Tokens

---

## Controls

- Button / Primary
- Button / Secondary
- Button / Success
- Button / Warning

---

## Cards

- Inventory Slot
- Recipe Card
- Shop Item Card
- Reward Card

---

## Dialogs

- NPC Dialog
- Confirmation Dialog
- Choice Dialog

---

## Economy

- Currency Badge
- Price Badge
- Reward Badge

---

## Navigation

- Tab
- Pagination Dot
- Controller Hint

---

# Codex Prompt Rules

When generating UI:

1. Use only defined design tokens.
2. Use rounded corners everywhere.
3. Never use sharp rectangles.
4. Use warm neutral backgrounds.
5. Use large spacing.
6. Use colorful icons.
7. Prioritize readability over density.
8. All components must support:
   - Default
   - Hover
   - Selected
   - Disabled
9. Follow 8px spacing grid.
10. Match Animal Crossing visual language without directly copying Nintendo assets.

---

# Preferred Tech Stack

React:

- React
- TypeScript
- Vite

Game UI:

- PixiJS
- React Pixi

Styling:

- CSS Variables
- Design Tokens

Animation:

- Framer Motion
- GSAP

Icons:

- Custom SVG
