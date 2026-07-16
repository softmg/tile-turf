import { useEffect, useRef, useState } from "react";
import { resolveLocale, setAppLocale } from "@/lib/i18n";

type LoadingApi = {
  ready?: () => void;
};

type GameplayApi = {
  start?: () => void;
  stop?: () => void;
};

type YandexPlayer = {
  getData: (keys?: string[]) => Promise<Record<string, unknown>>;
  setData: (data: Record<string, unknown>, flush?: boolean) => Promise<void>;
};

type YandexGamesSdk = {
  environment?: {
    i18n?: {
      lang?: string;
    };
  };
  features?: {
    LoadingAPI?: LoadingApi;
    GameplayAPI?: GameplayApi;
  };
  getPlayer?: (options?: { scopes?: boolean }) => Promise<YandexPlayer>;
};

declare global {
  interface Window {
    YaGames?: {
      init: () => Promise<YandexGamesSdk>;
    };
    __yandexSdkScriptReady?: Promise<void>;
    initSDK?: () => void;
    __rejectYandexSdkScript?: () => void;
  }
}

export type YandexProgress = {
  unlockedLevel?: number;
  firstLaunchDone?: boolean;
  gameplayTutorialSeen?: string[];
};

const isYandexMode = import.meta.env.MODE === "yandex";
export const isYandexGamesBuild = isYandexMode;
const progressKey = "tileTurfProgress";

let sdkPromise: Promise<YandexGamesSdk | null> | null = null;
let playerPromise: Promise<YandexPlayer | null> | null = null;
let loadingReadySent = false;
let gameplayActive = false;
let saveChain = Promise.resolve();
let cachedProgress: YandexProgress = {};

const warn = (message: string, error: unknown) => {
  if (import.meta.env.DEV) console.warn(message, error);
};

export const getYandexSdk = () => {
  if (!isYandexMode || typeof window === "undefined") return Promise.resolve(null);
  if (!sdkPromise) {
    sdkPromise = (async () => {
      await window.__yandexSdkScriptReady;
      if (!window.YaGames) throw new Error("Yandex Games SDK is not available.");
      const sdk = await window.YaGames.init();
      const lang = sdk.environment?.i18n?.lang;
      if (lang) setAppLocale(resolveLocale(lang));
      return sdk;
    })().catch((error) => {
      warn("[YandexGames] SDK initialization failed", error);
      return null;
    });
  }
  return sdkPromise;
};

const getPlayer = () => {
  if (!playerPromise) {
    playerPromise = getYandexSdk()
      .then((sdk) => sdk?.getPlayer?.({ scopes: false }) ?? null)
      .catch((error) => {
        warn("[YandexGames] Player initialization failed", error);
        return null;
      });
  }
  return playerPromise;
};

export const loadYandexProgress = async (): Promise<YandexProgress | null> => {
  const player = await getPlayer();
  if (!player) return null;
  try {
    const data = await player.getData([progressKey]);
    const progress = data[progressKey];
    if (!progress || typeof progress !== "object" || Array.isArray(progress)) return null;
    cachedProgress = progress as YandexProgress;
    return cachedProgress;
  } catch (error) {
    warn("[YandexGames] Progress read failed", error);
    return null;
  }
};

export const saveYandexProgress = (progress: YandexProgress) => {
  cachedProgress = { ...cachedProgress, ...progress };
  saveChain = saveChain
    .catch(() => undefined)
    .then(async () => {
      const player = await getPlayer();
      if (!player) return;
      await player.setData({ [progressKey]: cachedProgress }, true);
    })
    .catch((error) => {
      warn("[YandexGames] Progress write failed", error);
    });
  return saveChain;
};

export const sendYandexLoadingReady = () => {
  if (loadingReadySent) return;
  loadingReadySent = true;
  void getYandexSdk().then((sdk) => {
    sdk?.features?.LoadingAPI?.ready?.();
  });
};

const setYandexGameplayActive = (active: boolean) => {
  if (gameplayActive === active) return;
  gameplayActive = active;
  void getYandexSdk().then((sdk) => {
    if (active) sdk?.features?.GameplayAPI?.start?.();
    else sdk?.features?.GameplayAPI?.stop?.();
  });
};

export const useYandexLoadingReady = (ready: boolean) => {
  useEffect(() => {
    if (ready) sendYandexLoadingReady();
  }, [ready]);
};

export const useYandexGameplay = (active: boolean) => {
  const [visible, setVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState !== "hidden",
  );

  useEffect(() => {
    const onVisibilityChange = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    setYandexGameplayActive(active && visible);
    return () => setYandexGameplayActive(false);
  }, [active, visible]);
};

export const usePreventYandexContextMenu = (enabled: boolean) => {
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      if (enabledRef.current) event.preventDefault();
    };
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, []);
};
