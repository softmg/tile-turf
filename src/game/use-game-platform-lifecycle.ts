import { useEffect, useState } from "react";
import {
  installGameAudioLifecycle,
  setGameAudioSuspended,
  setGameMusicBlocked,
} from "@/game/audio";
import { useYandexPlatformPaused } from "@/lib/yandex-games";

export const useGamePlatformLifecycle = (matchOver: boolean) => {
  const [pageHidden, setPageHidden] = useState(false);
  const yandexPaused = useYandexPlatformPaused();

  useEffect(() => installGameAudioLifecycle(), []);

  useEffect(() => {
    const syncVisibility = () => setPageHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", syncVisibility);
    syncVisibility();
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  useEffect(() => {
    setGameAudioSuspended("yandex-platform", yandexPaused);
    return () => setGameAudioSuspended("yandex-platform", false);
  }, [yandexPaused]);

  useEffect(() => {
    setGameMusicBlocked("match-over", matchOver);
    return () => setGameMusicBlocked("match-over", false);
  }, [matchOver]);

  return pageHidden || yandexPaused;
};
