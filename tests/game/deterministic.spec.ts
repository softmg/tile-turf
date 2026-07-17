import { expect, test, type Browser, type Page } from "@playwright/test";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => string;
    move_game_direction?: (direction: "UP" | "DOWN" | "LEFT" | "RIGHT") => string;
  }
}

const BOARD_SIZE = 8;
const FIRST_LAUNCH_DONE_KEY = "isogrid:first-launch-done:v1";
const GAMEPLAY_TUTORIAL_SEEN_KEY = "isogrid:gameplay-tutorial:v1";

type Scenario = "chest" | "pause-bomb" | "bomb" | "arrow" | "bot";

const trackRuntimeErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
};

const waitForGameHooks = async (page: Page, timeout = 10_000) => {
  await page.waitForFunction(
    () =>
      typeof window.render_game_to_text === "function" &&
      typeof window.advanceTime === "function" &&
      typeof window.move_game_direction === "function",
    undefined,
    { timeout },
  );
};

const renderGame = async (page: Page) => page.evaluate(() => window.render_game_to_text?.() ?? "");

const advanceGame = async (page: Page, ms: number) =>
  page.evaluate((duration) => window.advanceTime?.(duration) ?? "", ms);

const startScenario = async (page: Page, scenario: Scenario) => {
  await page.addInitScript(
    ({ firstLaunchDoneKey, tutorialSeenKey }) => {
      window.localStorage.setItem(firstLaunchDoneKey, "1");
      window.localStorage.setItem(tutorialSeenKey, "paint,chest,boots,bomb,arrow");
    },
    {
      firstLaunchDoneKey: FIRST_LAUNCH_DONE_KEY,
      tutorialSeenKey: GAMEPLAY_TUTORIAL_SEEN_KEY,
    },
  );
  await page.goto(`/?deterministic=1&scenario=${scenario}`);
  const playButton = page.getByRole("button", { name: "Play Level 1" });
  await expect(playButton).toBeVisible();
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await playButton.isVisible()) await playButton.click();
    const ready = await waitForGameHooks(page, 2_000)
      .then(() => true)
      .catch(() => false);
    if (ready) {
      await expect(page.getByText("Get ready")).toBeHidden({ timeout: 5_000 });
      return;
    }
  }
  await waitForGameHooks(page);
  await expect(page.getByText("Get ready")).toBeHidden({ timeout: 5_000 });
};

const valueLine = (text: string, key: string) => {
  const prefix = `${key}=`;
  const line = text.split("\n").find((entry) => entry.startsWith(prefix));
  if (!line) throw new Error(`Missing ${key} line in:\n${text}`);
  return line.slice(prefix.length);
};

const parseScores = (text: string, key: "banked" | "scores") =>
  Object.fromEntries(
    valueLine(text, key)
      .split(",")
      .map((entry) => {
        const [skin, value] = entry.split(":");
        return [skin, Number(value)];
      }),
  ) as Record<string, number>;

const parsePlayer = (text: string) => {
  const line = valueLine(text, "player");
  const position = line.match(/^\d+,\d+/)?.[0] ?? "0,0";
  const [xText, yText] = position.split(",");
  const stunnedMs = Number(line.match(/stunnedMs=(\d+)/)?.[1] ?? 0);
  const boostMs = Number(line.match(/boostMs=(\d+)/)?.[1] ?? 0);
  return { position, x: Number(xText), y: Number(yText), stunnedMs, boostMs };
};

const parseFirstBomb = (text: string) => {
  const line = valueLine(text, "bombs");
  if (line === "none") return null;
  const match = line
    .split(";")[0]
    .match(/^(\d+),(\d+),phase=([^,]+),warningElapsed=(\d+),explosionElapsed=(\d+)$/);
  if (!match) throw new Error(`Unparseable bomb line: ${line}`);
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    phase: match[3],
    warningElapsed: Number(match[4]),
    explosionElapsed: Number(match[5]),
  };
};

const gridRows = (text: string) => text.split("\n").slice(-BOARD_SIZE);
const countGridMarks = (text: string, mark: string) =>
  gridRows(text)
    .join("")
    .split("")
    .filter((cell) => cell === mark).length;

const moveAndAdvance = async (
  page: Page,
  key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
) => {
  const direction = {
    ArrowUp: "UP",
    ArrowDown: "DOWN",
    ArrowLeft: "LEFT",
    ArrowRight: "RIGHT",
  } as const;
  await page.evaluate(
    (nextDirection) => window.move_game_direction?.(nextDirection),
    direction[key],
  );
  return advanceGame(page, 400);
};

test("fresh storage starts level 1 tutorial and locked levels stay disabled", async ({ page }) => {
  const errors = trackRuntimeErrors(page);
  await page.addInitScript(() => window.localStorage.clear());

  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Paint tiles" })).toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), FIRST_LAUNCH_DONE_KEY))
    .toBe("1");
  await page.evaluate(
    ({ firstLaunchDoneKey, tutorialSeenKey }) => {
      window.localStorage.setItem(firstLaunchDoneKey, "1");
      window.localStorage.setItem(tutorialSeenKey, "paint,chest,boots,bomb,arrow");
    },
    {
      firstLaunchDoneKey: FIRST_LAUNCH_DONE_KEY,
      tutorialSeenKey: GAMEPLAY_TUTORIAL_SEEN_KEY,
    },
  );
  await page.reload();

  await expect(page.getByRole("button", { name: "Play Level 1" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Level 2 locked" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Level 10 locked" })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("pause freezes game time and bomb warning timers", async ({ page }) => {
  await startScenario(page, "pause-bomb");

  const beforePause = await advanceGame(page, 500);
  const beforeBomb = parseFirstBomb(beforePause);
  expect(beforeBomb).toMatchObject({ x: 3, y: 3, phase: "warning", warningElapsed: 500 });

  await page.getByRole("button", { name: "Settings" }).click();
  await expect.poll(() => renderGame(page).then((text) => valueLine(text, "paused"))).toBe("true");
  const pausedText = await renderGame(page);
  const pausedBomb = parseFirstBomb(pausedText);

  const afterPausedAdvance = await advanceGame(page, 5000);
  expect(valueLine(afterPausedAdvance, "time")).toBe(valueLine(pausedText, "time"));
  expect(parseFirstBomb(afterPausedAdvance)?.warningElapsed).toBe(pausedBomb?.warningElapsed);

  await page.getByRole("button", { name: /resume/i }).click();
  await expect.poll(() => renderGame(page).then((text) => valueLine(text, "paused"))).toBe("false");
  const resumed = await advanceGame(page, 500);
  expect(Number(valueLine(resumed, "time"))).toBeGreaterThan(
    Number(valueLine(afterPausedAdvance, "time")),
  );
  expect(parseFirstBomb(resumed)?.warningElapsed).toBeGreaterThan(pausedBomb?.warningElapsed ?? 0);
});

test("chest banks painted tiles and clears player ownership", async ({ page }) => {
  await startScenario(page, "chest");
  expect(valueLine(await renderGame(page), "chest")).toBe("2,0");

  await moveAndAdvance(page, "ArrowRight");
  const afterChest = await moveAndAdvance(page, "ArrowRight");

  expect(parseScores(afterChest, "banked").plush).toBe(3);
  expect(parseScores(afterChest, "scores").plush).toBe(0);
  expect(countGridMarks(afterChest, "P")).toBe(1);
});

test("bomb stuns only on the exact tile and clears player ownership", async ({ page }) => {
  await startScenario(page, "bomb");
  expect(parseFirstBomb(await renderGame(page))).toMatchObject({ x: 0, y: 0, phase: "warning" });

  await moveAndAdvance(page, "ArrowRight");
  const beforeExplosion = await moveAndAdvance(page, "ArrowLeft");
  expect(parseScores(beforeExplosion, "scores").plush).toBe(2);

  const afterExplosion = await advanceGame(page, 1300);
  expect(parsePlayer(afterExplosion).stunnedMs).toBeGreaterThan(0);
  expect(parseScores(afterExplosion, "scores").plush).toBe(0);
  expect(countGridMarks(afterExplosion, "P")).toBe(1);

  await page.keyboard.press("ArrowRight");
  const duringStun = await advanceGame(page, 400);
  expect(parsePlayer(duringStun)).toMatchObject({ x: 0, y: 0 });

  await advanceGame(page, 2100);
  await page.keyboard.press("ArrowRight");
  const afterRecovery = await advanceGame(page, 400);
  expect(parsePlayer(afterRecovery)).toMatchObject({ x: 1, y: 0 });
});

test("arrow paints the configured line on landing", async ({ page }) => {
  await startScenario(page, "arrow");
  expect(valueLine(await renderGame(page), "arrow")).toBe(
    "1,0,dir=1,rotateElapsed=0,lifeElapsed=0",
  );

  const afterArrow = await moveAndAdvance(page, "ArrowRight");

  expect(valueLine(afterArrow, "arrow")).toBe("none");
  expect(gridRows(afterArrow)[0]).toBe("PPPPPPPP");
  expect(parseScores(afterArrow, "scores").plush).toBe(8);
});

test("seeded bot movement is deterministic", async ({ browser }) => {
  const runBotScenario = async (activeBrowser: Browser) => {
    const page = await activeBrowser.newPage();
    await startScenario(page, "bot");
    expect(valueLine(await renderGame(page), "bots")).toContain("banana:7,7");
    const text = await advanceGame(page, 2000);
    await page.close();
    return text;
  };

  const first = await runBotScenario(browser);
  const second = await runBotScenario(browser);

  expect(valueLine(first, "bots")).toBe(valueLine(second, "bots"));
  expect(first).toBe(second);
  expect(valueLine(first, "bots")).not.toContain("banana:7,7");
});
