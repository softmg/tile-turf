---
name: yagames-aso
description: "Prepare Yandex Games ASO materials for a web game in Russian and English: store-page copy within field limits and matching screenshot sets in landscape 16:9 and portrait 9:16. Use when Codex needs to inspect a game, draft or refine its Yandex Games listing texts, describe controls, run localized builds, capture store screenshots, validate JPEG or PNG output, or package reusable store assets for publication."
---

# Yandex Games ASO

Prepare publication-ready Russian and English store assets for a Yandex Games web game.

## Read First

Read `references/store-fields.md` before drafting copy or capturing screenshots.

## Workflow

### 1. Inspect The Game

1. Read the repository instructions before any task.
2. Inspect the README, package scripts, localization layer, tutorial copy, controls, level definitions, progress logic, and platform integration.
3. Run the game locally when source inspection is insufficient.
4. Record only verified facts:
   - player goal;
   - core action loop;
   - controls on desktop and mobile;
   - number of levels and chapters;
   - scoring, stars, timers, and progression;
   - special mechanics;
   - cloud-save or platform features.
5. Do not advertise disabled, planned, or unverified features.

### 2. Draft Russian And English Copy

Prepare both languages together so they describe the same product.

For each language produce:

1. Title.
2. SEO description.
3. About the game.
4. Short description.
5. How to play.

Use the exact limits in `references/store-fields.md`. Count characters before returning the copy.

Write the fields with different purposes:

- Title: recognizable game name.
- SEO description: one search-friendly sentence describing genre, core action, and appeal.
- About the game: concise store copy describing the loop, content scale, progression, and verified special mechanics.
- Short description: one compact value proposition.
- How to play: controls only. Keep it dry and operational. Do not repeat the goal, scoring system, level rules, special mechanics, strategy advice, or marketing copy unless the user explicitly requests them.

Use natural Russian and idiomatic English. Avoid translating word-for-word when a clearer localized phrase exists.

Return every field with its character count in the form `used/limit`.

### 3. Plan Screenshot Scenes

Prepare two distinct screenshots for each language. Default to the same two scenes in both languages:

1. Gameplay: a visually rich gameplay state that clearly shows the board, character, HUD, and a special mechanic when available.
2. Content overview: a level map, level-selection screen, chapter screen, or another polished screen that communicates content scale.

Keep scenes equivalent across RU and EN. Differences should come from localization, not from unrelated game states.

Avoid:

- loading states;
- blank canvases;
- debug overlays;
- partially rendered Pixi, Canvas, or WebGL scenes;
- tutorial popups that obscure the board unless the tutorial itself is the intended screenshot;
- accidental ads, browser chrome, or development UI.

### 4. Capture Both Orientations

Create two sets:

- landscape: `1920x1080`, ratio `16:9`;
- portrait: `1080x1920`, ratio `9:16`.

These defaults stay inside Yandex Games' accepted `1280-2560 px` long-side range.

Prefer JPEG quality `95` for store screenshots. PNG is acceptable only when saved without an alpha channel.

Use the in-app browser to inspect and validate local pages first. For deterministic file export at exact dimensions, run `scripts/capture-yagames-screenshots.ps1` with localized scene URLs.

If the game has no direct URL for a target scene:

1. Prefer an existing local-only debug route, query parameter, fixture, or seeded state.
2. Otherwise add the smallest temporary capture hook needed to open the selected scene.
3. Keep the hook local and narrowly scoped.
4. Remove it immediately after export.
5. Verify with `git diff` that no capture-only source changes remain.

For Pixi, Canvas, or WebGL games, capture retries are normal because HUD can render before textures and canvas content. Use a file-size threshold as an initial signal, then inspect every final image visually. Never accept a screenshot solely because the file exists.

### 5. Validate Deliverables

For each final screenshot verify:

1. Exact dimensions.
2. Expected orientation and ratio.
3. JPEG `24-bit RGB`, or PNG without alpha.
4. Correct language.
5. Fully rendered scene.
6. Equivalent RU and EN states.
7. No temporary capture source changes remain.

Use stable filenames:

```text
screenshots/yandex-games/
  landscape/
    ru-01-gameplay.jpg
    ru-02-level-map.jpg
    en-01-gameplay.jpg
    en-02-level-map.jpg
  portrait/
    ru-01-gameplay.jpg
    ru-02-level-map.jpg
    en-01-gameplay.jpg
    en-02-level-map.jpg
```

If the project already uses another output folder, preserve its convention.

### 6. Report Results

Return:

1. Final RU and EN copy grouped by field with counts.
2. Absolute paths to the screenshot folders.
3. A short validation summary with dimensions, format, and alpha-channel status.
4. Any source changes that remain. Normally there should be none.
