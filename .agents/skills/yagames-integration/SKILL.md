---
name: yagames-integration
description: Audit, implement, test, and document Yandex Games SDK integration for JavaScript and TypeScript HTML5 browser games. Use for SDK loading, Game Ready and GameplayAPI lifecycle, localization, cloud saves, ads, leaderboards, purchases, CSP, local testing, archive packaging, draft-console setup, and moderation checks.
---

# Yandex Games Integration

Use this skill for JavaScript and TypeScript HTML5 games regardless of framework,
renderer, bundler, package manager, or hosting layout.

Treat bundled references as a working checklist, not as a replacement for the
current official Yandex Games documentation. Re-open official pages before
relying on loader URLs, API availability, limits, console fields, or moderation
requirements.

## Workflow

1. Search the project for `AGENTS.md` before inspecting source files.
2. Run `scripts/audit-yagames.ps1 -Root <project-root>` for a first pass.
3. Read the actual integration surface:
   - SDK adapter or bridge;
   - HTML entry points;
   - project manifest and build scripts;
   - bundler or build configuration;
   - save persistence;
   - locale selection;
   - lifecycle transitions;
   - ad, leaderboard, purchase, and backend call sites;
   - environment files;
   - generated output and release archives.
4. Read [references/platform-checklist.md](references/platform-checklist.md).
5. Browse the relevant official Yandex Games pages before changing code or
   publishing long-lived guidance.
6. Separate:
   - required platform behavior;
   - current implementation;
   - optional SDK modules;
   - console configuration;
   - release pipeline;
   - remaining manual draft checks.
7. Implement requested changes. Preserve local-only mocks where useful, but do
   not silently replace hosted SDK failures with mocks.
8. Run the project's available tests, static checks, build, packaging command,
   built-output inspection, and ZIP-entry inspection.

## Required Baseline

For an archive uploaded to Yandex hosting:

- load the SDK through the documented relative `/sdk.js` path;
- call `YaGames.init()` only after the loader is ready;
- keep initial rendering independent from SDK network success where the game
  architecture allows it;
- call `ysdk.features.LoadingAPI?.ready()` only when the game is interactive
  and no loading screen remains;
- align `ysdk.features.GameplayAPI?.start()` and `.stop()` with real gameplay;
- serialize gameplay transitions and suppress duplicate target states;
- derive portal locale from `ysdk.environment.i18n.lang` when localization is
  implemented;
- do not show manual sign-in buttons, sign-in prompts, or player-facing text
  that names Yandex, Yandex ID, or any third-party company; if the player is
  already externally authorized, cloud saves should work automatically,
  otherwise the game should continue without manual authorization UI;
- prevent text selection and the browser context menu across the playable UI;
- emit release asset URLs that resolve inside the uploaded archive;
- place `index.html` at ZIP root;
- write ZIP entry names with `/`, never Windows `\`;
- keep generated release archives out of version control;
- inspect the hosted draft with the debug panel before moderation.

For own-domain hosting, confirm the current official absolute SDK URL before
changing the loader. The archive-hosted `/sdk.js` rule does not apply unchanged.

## Optional Modules

Audit and implement only the modules the game actually uses:

- Player data and authorization;
- fullscreen and rewarded ads;
- leaderboards;
- in-app purchases;
- remote config;
- review prompts;
- shortcuts;
- server time;
- external services allowed by CSP.

## Flag Explicitly

- obsolete SDK URLs such as `https://yandex.ru/games/sdk/v2`;
- HTML entry points missing the documented `/sdk.js` loader;
- SDK methods called before initialization;
- hosted SDK failures silently converted into local mocks;
- `LoadingAPI.ready()` before the game is interactive;
- duplicate or overlapping gameplay transitions;
- gameplay left active during pause, menu, hidden-tab, or ad states;
- repeated uncached `ysdk.getPlayer()` calls;
- manual authorization UI, login retry UI, or player-facing third-party brand
  mentions in game screens;
- selectable game UI text or an enabled right-click context menu;
- overlapping or unbounded cloud writes;
- locale based only on browser language when portal locale is required;
- rewards granted before rewarded-ad confirmation;
- ads without gameplay and audio suspension;
- deprecated leaderboard initialization through `ysdk.getLeaderboards()`;
- leaderboard calls without matching console configuration or availability
  checks where required;
- purchases without processing and consuming pending purchases;
- unintended backend URLs or service-storage URLs in static releases;
- root-relative or absolute asset URLs that break archive hosting;
- ZIP archives with an extra wrapper directory;
- ZIP entry names containing `\`;
- release archives not covered by ignore rules.

## References

- Read [references/platform-checklist.md](references/platform-checklist.md).
