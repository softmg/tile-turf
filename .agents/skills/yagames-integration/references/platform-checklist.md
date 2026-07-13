# Yandex Games HTML5 Integration Checklist

Use this checklist for JavaScript and TypeScript browser games. It is
framework-agnostic and build-tool-agnostic.

## Official Documentation

Re-open the relevant official pages before implementation:

- SDK connection: https://yandex.ru/dev/games/doc/ru/sdk/sdk-about
- Game Ready and gameplay markup: https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events
- Player data: https://yandex.ru/dev/games/doc/ru/sdk/sdk-player
- Advertising: https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv
- Leaderboards: https://yandex.ru/dev/games/doc/ru/sdk/sdk-leaderboard
- In-app purchases: https://yandex.ru/dev/games/doc/ru/sdk/sdk-purchases
- Local launch and SDK proxy: https://yandex.ru/dev/games/doc/ru/concepts/local-launch
- Requirements: https://yandex.ru/dev/games/doc/ru/concepts/requirements
- Draft fields: https://yandex.ru/dev/games/doc/ru/console/add-new-game/draft
- Performance markers: https://yandex.ru/dev/games/doc/ru/concepts/performance

Record an access date in release documentation because platform rules change.

## SDK Connection

For an archive uploaded through the developer console, use `/sdk.js`:

```html
<script src="/sdk.js"></script>
```

Dynamic loading is equally valid:

```js
const script = document.createElement("script");
script.src = "/sdk.js";
script.async = true;
script.onload = initSDK;
document.body.append(script);
```

Initialize only after loader completion:

```js
const ysdk = await YaGames.init();
```

For own-domain hosting, confirm the current official absolute SDK URL. Do not
copy archive-hosting assumptions into an own-domain release.

Use the official local proxy for SDK testing:

```text
npx @yandex-games/sdk-dev-proxy -p <build-output>
npx @yandex-games/sdk-dev-proxy -h <local-server>
npx @yandex-games/sdk-dev-proxy -p <build-output> --dev-mode=true
```

The proxy can also accept `--app-id`, `--csp`, and other documented options.
Do not download and commit `sdk.js`.

Verify the hosted loader through `debug-mode=16`. The expected indicator is
`IT`; `IF` means an obsolete loader is used.

## Lifecycle

Call:

```js
ysdk.features.LoadingAPI?.ready();
```

only after required resources are loaded, interactive controls are ready, and
loading screens are gone.

Call:

```js
ysdk.features.GameplayAPI?.start();
ysdk.features.GameplayAPI?.stop();
```

to reflect actual gameplay. Stop for menus, pause, completion, failure, hidden
tabs, fullscreen ads, and rewarded ads. Start again only when gameplay resumes.
Serialize transitions and suppress duplicate target states so multiple event
sources cannot start an already-running platform timer.

## Player Data And Locale

Use Player data for cloud saves:

```js
const player = await ysdk.getPlayer({ scopes: false });
const data = await player.getData(["progress"]);
await player.setData({ progress }, true);
```

Cache the Player object, normalize loaded data, serialize or coalesce writes,
and preserve a deliberate guest/offline strategy. Re-check current request and
payload limits in official docs before implementation.

Read portal locale from:

```js
ysdk.environment.i18n.lang
```

Map it to supported locales and keep a fallback. Update document language when
appropriate.

## Advertising

Fullscreen ads:

```js
ysdk.adv.showFullscreenAdv({ callbacks: { onOpen, onClose, onError } });
```

Use only at logical pauses. Suspend gameplay and audio while an ad is open and
restore them after close or error.

Rewarded ads:

```js
ysdk.adv.showRewardedVideo({
  callbacks: { onOpen, onRewarded, onClose, onError },
});
```

Require an explicit player action. Grant the reward only after `onRewarded`.

## Leaderboards

Use the current direct API:

```js
await ysdk.leaderboards.setScore("score", value);
const entries = await ysdk.leaderboards.getEntries("score", options);
```

Do not initialize leaderboards through deprecated `ysdk.getLeaderboards()`.
Create matching technical leaderboard names in the developer console. Use
`ysdk.isAvailableMethod()` where required, handle authorization requirements,
and re-check current rate limits in official docs.

## Purchases

If the game uses purchases:

- enable and configure purchases in the developer console;
- initialize payments according to the current docs;
- process purchased items idempotently;
- consume processed purchases;
- check pending unprocessed purchases on startup;
- choose signed responses deliberately when server-side validation is used;
- test purchases only after consumption logic exists.

## Static Release And ZIP

Detect the actual build command and output directory. Do not assume a framework,
bundler, package manager, or folder name.

For archive hosting:

- keep runtime URLs resolvable relative to the uploaded `index.html`;
- inspect built HTML, CSS, JS, JSON, manifests, and maps for accidental
  external backend URLs and service-storage URLs;
- package output contents, not the output directory itself;
- keep `index.html` at ZIP root;
- ensure ZIP entry names use `/`, for example `assets/index.js`;
- reject ZIP entry names such as `assets\index.js`;
- inspect the final ZIP, not only the source output directory;
- ignore generated archives in version control.

Root-relative URLs such as `/assets/index.js` often resolve against the hosting
root instead of the uploaded archive. Prefer archive-relative URLs unless the
actual hosting contract explicitly requires otherwise.

## Draft Verification

Before moderation, verify:

1. Loader debug indicator is `IT`.
2. No unhandled console errors or asset `404` responses remain.
3. `LoadingAPI.ready()` fires at the playable state.
4. Gameplay transitions match visible behavior without duplicates.
5. Locale follows portal language when localization exists.
6. Guest and authorized save flows behave as designed.
7. Ads pause and resume gameplay and audio correctly.
8. Rewarded ads grant rewards only after confirmation.
9. Leaderboard names, authorization, and rate limits are handled.
10. Purchases are processed and consumed when enabled.
11. External hosts required by the game are allowed by CSP.
12. `index.html` is at ZIP root.
13. ZIP entry names use `/` and contain no `\`.
14. Release asset URLs resolve from the uploaded draft.
15. Uploaded chunk hashes match the newest archive.
