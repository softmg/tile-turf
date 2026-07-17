import { expect, test } from "@playwright/test";

const FIRST_LAUNCH_DONE_KEY = "isogrid:first-launch-done:v1";
const GAMEPLAY_TUTORIAL_SEEN_KEY = "isogrid:gameplay-tutorial:v1";

const prepareReturningPlayer = async (page: import("@playwright/test").Page) => {
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
};

const prepareFirstLaunchWithoutTutorial = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(
    ({ firstLaunchDoneKey, tutorialSeenKey }) => {
      window.localStorage.removeItem(firstLaunchDoneKey);
      window.localStorage.setItem(tutorialSeenKey, "paint,chest,boots,bomb,arrow");
    },
    {
      firstLaunchDoneKey: FIRST_LAUNCH_DONE_KEY,
      tutorialSeenKey: GAMEPLAY_TUTORIAL_SEEN_KEY,
    },
  );
};

test("external page pause freezes and resumes the start countdown", async ({ page }) => {
  await prepareFirstLaunchWithoutTutorial(page);
  await page.goto("/");
  await expect(page.getByText("Get ready")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("3", { exact: true })).toBeVisible();

  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __testVisibilityState?: DocumentVisibilityState;
    };
    testWindow.__testVisibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => testWindow.__testVisibilityState,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await page.waitForTimeout(800);
  await expect(page.getByText("3", { exact: true })).toBeVisible();

  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __testVisibilityState?: DocumentVisibilityState;
    };
    testWindow.__testVisibilityState = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await expect(page.getByText("2", { exact: true })).toBeVisible();
});

test("audio asset failures do not produce unhandled page errors", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/*.ogg", (route) => route.abort());
  await prepareFirstLaunchWithoutTutorial(page);

  await page.goto("/");
  await expect(page.getByText("Get ready")).toBeVisible({ timeout: 10_000 });
  await page.mouse.click(10, 10);
  await page.waitForTimeout(800);

  expect(pageErrors).toEqual([]);
});

test("browser locale updates the visible interface without a hydration error", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "ru-RU" });
  const page = await context.newPage();
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydration/i.test(message.text())) {
      hydrationErrors.push(message.text());
    }
  });
  await prepareReturningPlayer(page);

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Играть уровень 1" })).toBeVisible();
  await expect(page.getByText("Выбор уровня")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  expect(hydrationErrors).toEqual([]);

  await context.close();
});
