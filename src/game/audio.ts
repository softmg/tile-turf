import arrowUrl from "../../assets/sounds/arrow.ogg?url";
import bombUrl from "../../assets/sounds/bomb.ogg?url";
import bootsUrl from "../../assets/sounds/boots.ogg?url";
import chestUrl from "../../assets/sounds/chest.ogg?url";
import clickUrl from "../../assets/sounds/click.ogg?url";
import jumpUrl from "../../assets/sounds/jump.ogg?url";
import loseUrl from "../../assets/sounds/lose.ogg?url";
import loopUrl from "../../assets/sounds/loop.ogg?url";
import winUrl from "../../assets/sounds/win.ogg?url";
import { AUDIO_VOLUMES } from "@/game/audio-volume";

export type GameSound = Exclude<keyof typeof AUDIO_VOLUMES, "master">;

const SOUND_URLS: Record<GameSound, string> = {
  loop: loopUrl,
  jump: jumpUrl,
  bomb: bombUrl,
  arrow: arrowUrl,
  boots: bootsUrl,
  chest: chestUrl,
  click: clickUrl,
  win: winUrl,
  lose: loseUrl,
};

const buffers = new Map<GameSound, AudioBuffer>();
const bufferPromises = new Map<GameSound, Promise<AudioBuffer>>();
const activeSources = new Set<AudioBufferSourceNode>();
const suspensionReasons = new Set<string>();
const musicBlockReasons = new Set<string>();

let context: AudioContext | null = null;
let loopSource: AudioBufferSourceNode | null = null;
let unlocked = false;

const getAudioContext = () => {
  if (context || typeof window === "undefined") return context;
  const AudioContextClass =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
  if (!AudioContextClass) return null;
  context = new AudioContextClass();
  return context;
};

const loadBuffer = (sound: GameSound) => {
  const cached = buffers.get(sound);
  if (cached) return Promise.resolve(cached);

  const pending = bufferPromises.get(sound);
  if (pending) return pending;

  const audioContext = getAudioContext();
  if (!audioContext) return Promise.reject(new Error("Web Audio API is unavailable."));

  const promise = fetch(SOUND_URLS[sound])
    .then((response) => {
      if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((encoded) => audioContext.decodeAudioData(encoded))
    .then((buffer) => {
      buffers.set(sound, buffer);
      return buffer;
    })
    .finally(() => bufferPromises.delete(sound));

  bufferPromises.set(sound, promise);
  return promise;
};

const stopSource = (source: AudioBufferSourceNode) => {
  try {
    source.stop();
  } catch {
    // A source can already be stopped by its natural onended callback.
  }
  source.disconnect();
  activeSources.delete(source);
};

const stopAllSources = () => {
  for (const source of [...activeSources]) stopSource(source);
  loopSource = null;
};

const canPlay = () => unlocked && context?.state === "running" && suspensionReasons.size === 0;

const startLoop = async () => {
  if (!canPlay() || musicBlockReasons.size > 0 || loopSource) return;
  const buffer = await loadBuffer("loop");
  if (!canPlay() || musicBlockReasons.size > 0 || loopSource || !context) return;

  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  source.loop = true;
  gain.gain.value = AUDIO_VOLUMES.master * AUDIO_VOLUMES.loop;
  source.connect(gain).connect(context.destination);
  source.onended = () => {
    activeSources.delete(source);
    if (loopSource === source) loopSource = null;
  };
  activeSources.add(source);
  loopSource = source;
  source.start();
};

const resumeAudio = () => {
  if (!unlocked || suspensionReasons.size > 0) return;
  const audioContext = getAudioContext();
  if (!audioContext) return;
  void audioContext
    .resume()
    .then(startLoop)
    .catch(() => undefined);
};

export const unlockGameAudio = () => {
  unlocked = true;
  resumeAudio();
};

export const playGameSound = async (sound: Exclude<GameSound, "loop">) => {
  if (!unlocked || suspensionReasons.size > 0) return;
  try {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    if (audioContext.state !== "running") await audioContext.resume();
    if (!canPlay()) return;
    const buffer = await loadBuffer(sound);
    if (!canPlay() || !context) return;

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = AUDIO_VOLUMES.master * AUDIO_VOLUMES[sound];
    source.connect(gain).connect(context.destination);
    source.onended = () => {
      activeSources.delete(source);
      source.disconnect();
    };
    activeSources.add(source);
    source.start();
  } catch (error) {
    if (import.meta.env.DEV) console.warn(`[Audio] Could not play "${sound}"`, error);
  }
};

export const setGameAudioSuspended = (reason: string, suspended: boolean) => {
  if (suspended) suspensionReasons.add(reason);
  else suspensionReasons.delete(reason);

  if (suspensionReasons.size > 0) {
    stopAllSources();
    if (context?.state === "running") void context.suspend().catch(() => undefined);
    return;
  }
  resumeAudio();
};

export const setGameMusicBlocked = (reason: string, blocked: boolean) => {
  if (blocked) musicBlockReasons.add(reason);
  else musicBlockReasons.delete(reason);

  if (musicBlockReasons.size > 0) {
    if (loopSource) stopSource(loopSource);
    loopSource = null;
    return;
  }
  void startLoop();
};

const isInterfaceControl = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(
    target.closest(
      'button, a, input, select, textarea, summary, [role="button"], [role="menuitem"], [role="tab"], [role="switch"]',
    ),
  );

export const installGameAudioLifecycle = () => {
  const unlock = () => unlockGameAudio();
  const onInterfaceClick = (event: MouseEvent) => {
    unlockGameAudio();
    if (isInterfaceControl(event.target)) void playGameSound("click");
  };
  const syncVisibility = () =>
    setGameAudioSuspended("page-hidden", document.visibilityState === "hidden");
  const onPageHide = () => setGameAudioSuspended("page-hidden", true);
  const onPageShow = () => syncVisibility();

  document.addEventListener("pointerdown", unlock);
  document.addEventListener("keydown", unlock);
  document.addEventListener("click", onInterfaceClick);
  document.addEventListener("visibilitychange", syncVisibility);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  syncVisibility();
  void startLoop();

  return () => {
    document.removeEventListener("pointerdown", unlock);
    document.removeEventListener("keydown", unlock);
    document.removeEventListener("click", onInterfaceClick);
    document.removeEventListener("visibilitychange", syncVisibility);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
  };
};
