import { useEffect, useSyncExternalStore } from "react";
import type { SkinId } from "@/game/game-constants";

export type Locale = "en" | "ru";

type TutorialStep = "paint" | "chest" | "boots" | "bomb" | "arrow";

export interface Messages {
  appTitle: string;
  appDescription: string;
  notFoundTitle: string;
  notFoundBody: string;
  goHome: string;
  errorTitle: string;
  errorBody: string;
  tryAgain: string;
  loadingField: string;
  getReady: string;
  levelShort: string;
  roundShort: string;
  bestOf: string;
  you: string;
  bots: string;
  versus: string;
  endOfRound: string;
  level: string;
  tie: string;
  roundTie: string;
  wins: string;
  won: string;
  pointsShort: string;
  matchScore: string;
  firstTo: string;
  previousRounds: string;
  continue: string;
  settings: string;
  paused: string;
  detour: string;
  reaction: string;
  match: string;
  resume: string;
  exitToLevelSelect: string;
  confirmExitMatch: string;
  zoom: string;
  movementDirection: string;
  turnUpLeft: string;
  turnUpRight: string;
  turnDownLeft: string;
  turnDownRight: string;
  levelPassed: string;
  levelFailed: string;
  selectLevel: string;
  pickLevel: string;
  levelLocked: string;
  levelLockedLabel: string;
  startLevelLabel: string;
  levelTitle: string;
  botSingular: string;
  botPlural: string;
  levelIntro: string;
  nextLevel: string;
  allLevelsCleared: string;
  retryLevel: string;
  playLevel: string;
  levelPassedScore: string;
  levelFailedBody: string;
  renderError: string;
  tutorialContinue: string;
  skins: Record<SkinId, string>;
  tutorial: Record<TutorialStep, { title: string; body: string }>;
}

const isYandexBuild = import.meta.env.MODE === "yandex";
const localeListeners = new Set<() => void>();

export const resolveLocale = (value: string | undefined | null): Locale => {
  const normalized = value?.toLowerCase() ?? "";
  return normalized.startsWith("ru") ? "ru" : "en";
};

let currentLocale: Locale = "en";
if (typeof document !== "undefined") document.documentElement.lang = currentLocale;

export const setAppLocale = (locale: Locale) => {
  if (currentLocale === locale) {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
    return;
  }
  currentLocale = locale;
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  for (const listener of localeListeners) listener();
};

export const getAppLocale = () => currentLocale;

export const useLocale = () => {
  useEffect(() => {
    if (!isYandexBuild && typeof navigator !== "undefined") {
      setAppLocale(resolveLocale(navigator.language));
    }
  }, []);

  return useSyncExternalStore(
    (listener) => {
      localeListeners.add(listener);
      return () => localeListeners.delete(listener);
    },
    getAppLocale,
    (): Locale => "en",
  );
};

const messages: Record<Locale, Messages> = {
  en: {
    appTitle: "Tile Turf",
    appDescription: "Move across tiles, paint turf, and bank points with chests.",
    notFoundTitle: "Page not found",
    notFoundBody: "The page you're looking for doesn't exist or has been moved.",
    goHome: "Go home",
    errorTitle: "This page didn't load",
    errorBody: "Something went wrong on our end. You can try refreshing or head back home.",
    tryAgain: "Try again",
    loadingField: "Loading field",
    getReady: "Get ready",
    levelShort: "Lvl",
    roundShort: "R",
    bestOf: "BO",
    you: "You",
    bots: "Bots",
    versus: "vs",
    endOfRound: "End of Round",
    level: "Level",
    tie: "Tie",
    roundTie: "It's a Tie!",
    wins: "wins!",
    won: "won",
    pointsShort: "pts",
    matchScore: "Match score",
    firstTo: "first to",
    previousRounds: "Previous rounds",
    continue: "Continue",
    settings: "Settings",
    paused: "Paused",
    detour: "Detour",
    reaction: "Reaction",
    match: "Match",
    resume: "Resume",
    exitToLevelSelect: "Exit to Level Select",
    confirmExitMatch: "Leave this match? Your current round wins and match history will be lost.",
    zoom: "Zoom",
    movementDirection: "Movement direction",
    turnUpLeft: "Turn up-left",
    turnUpRight: "Turn up-right",
    turnDownLeft: "Turn down-left",
    turnDownRight: "Turn down-right",
    levelPassed: "Level Passed",
    levelFailed: "Level Failed",
    selectLevel: "Select Level",
    pickLevel: "Pick an unlocked level or continue from the latest one.",
    levelLocked: "Locked",
    levelLockedLabel: "Level {level} locked",
    startLevelLabel: "Start level {level}, {bots} {botWord}",
    levelTitle: "Level {level} · {bots} {botWord}",
    botSingular: "bot",
    botPlural: "bots",
    levelIntro:
      "Jump across neighboring tiles to paint them. Grab chests to turn your painted turf into round points.",
    nextLevel: "Next Level",
    allLevelsCleared: "All Levels Cleared!",
    retryLevel: "Retry Level {level}",
    playLevel: "Play Level {level}",
    levelPassedScore: "You won {playerWins}-{botWins}.",
    levelFailedBody: "A bot reached {wins} wins first. Try again!",
    renderError: "Game renderer could not start. Return to the level menu and try again.",
    tutorialContinue: "Continue tutorial",
    skins: {
      plush: "Plush",
      banana: "Banana",
      dragon: "Dragon",
      cat: "Cat",
    },
    tutorial: {
      paint: {
        title: "Paint tiles",
        body: "Jump across neighboring tiles. Your color earns points.",
      },
      chest: {
        title: "Grab chests",
        body: "They turn painted tiles into round points.",
      },
      boots: {
        title: "Grab boots",
        body: "They briefly speed up your jumps.",
      },
      bomb: {
        title: "Watch bombs",
        body: "Explosions stun you and clear your color.",
      },
      arrow: {
        title: "Catch arrows",
        body: "They paint a whole row of tiles.",
      },
    },
  },
  ru: {
    appTitle: "Tile Turf",
    appDescription: "Прыгай по клеткам, закрашивай поле и забирай очки из сундуков.",
    notFoundTitle: "Страница не найдена",
    notFoundBody: "Такой страницы нет или она была перемещена.",
    goHome: "На главную",
    errorTitle: "Страница не загрузилась",
    errorBody: "Что-то пошло не так. Можно попробовать еще раз или вернуться на главную.",
    tryAgain: "Повторить",
    loadingField: "Загружаем поле",
    getReady: "Приготовься",
    levelShort: "Ур.",
    roundShort: "Р",
    bestOf: "До",
    you: "Ты",
    bots: "Боты",
    versus: "против",
    endOfRound: "Конец раунда",
    level: "Уровень",
    tie: "Ничья",
    roundTie: "Ничья!",
    wins: "побеждает!",
    won: "победил",
    pointsShort: "очк.",
    matchScore: "Счет матча",
    firstTo: "до",
    previousRounds: "Прошлые раунды",
    continue: "Продолжить",
    settings: "Настройки",
    paused: "Пауза",
    detour: "Обход",
    reaction: "Реакция",
    match: "Матч",
    resume: "Продолжить",
    exitToLevelSelect: "К выбору уровня",
    confirmExitMatch: "Выйти из матча? Победы в текущем матче и история раундов будут потеряны.",
    zoom: "Масштаб",
    movementDirection: "Направление движения",
    turnUpLeft: "Повернуть вверх-влево",
    turnUpRight: "Повернуть вверх-вправо",
    turnDownLeft: "Повернуть вниз-влево",
    turnDownRight: "Повернуть вниз-вправо",
    levelPassed: "Уровень пройден",
    levelFailed: "Уровень провален",
    selectLevel: "Выбор уровня",
    pickLevel: "Выбери открытый уровень или продолжи с последнего.",
    levelLocked: "Закрыто",
    levelLockedLabel: "Уровень {level} закрыт",
    startLevelLabel: "Начать уровень {level}, {bots} {botWord}",
    levelTitle: "Уровень {level} · {bots} {botWord}",
    botSingular: "бот",
    botPlural: "бота",
    levelIntro:
      "Прыгай по соседним клеткам, чтобы закрашивать их. Забирай сундуки, чтобы превращать поле в очки раунда.",
    nextLevel: "Следующий уровень",
    allLevelsCleared: "Все уровни пройдены!",
    retryLevel: "Повторить уровень {level}",
    playLevel: "Играть уровень {level}",
    levelPassedScore: "Ты победил со счетом {playerWins}-{botWins}.",
    levelFailedBody: "Бот первым набрал {wins} побед. Попробуй еще раз!",
    renderError: "Рендер игры не запустился. Вернись в меню уровней и попробуй еще раз.",
    tutorialContinue: "Продолжить обучение",
    skins: {
      plush: "Плюш",
      banana: "Банан",
      dragon: "Дракон",
      cat: "Кот",
    },
    tutorial: {
      paint: {
        title: "Закрашивай клетки",
        body: "Прыгай по соседним клеткам. Твой цвет приносит очки.",
      },
      chest: {
        title: "Бери сундуки",
        body: "Они превращают закрашенные клетки в очки раунда.",
      },
      boots: {
        title: "Бери ботинки",
        body: "Они ненадолго ускоряют прыжки.",
      },
      bomb: {
        title: "Остерегайся бомб",
        body: "Взрыв оглушает тебя и сбрасывает твой цвет.",
      },
      arrow: {
        title: "Лови стрелки",
        body: "Они закрашивают целый ряд клеток.",
      },
    },
  },
};

export const getMessages = (locale: Locale): Messages => messages[locale];

export const useMessages = () => getMessages(useLocale());

export const formatMessage = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

export const skinName = (messagesForLocale: Messages, skinId: SkinId) =>
  messagesForLocale.skins[skinId];
