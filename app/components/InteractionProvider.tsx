"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "prospect-scout-sounds";

export type FeedbackKind = "tap" | "select" | "confirm";

type InteractionContextValue = {
  soundsEnabled: boolean;
  setSoundsEnabled: (enabled: boolean) => void;
  feedback: (kind?: FeedbackKind) => void;
};

const InteractionContext = createContext<InteractionContextValue | null>(null);

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function tone(
  frequency: number,
  durationMs: number,
  volume: number,
  type: OscillatorType = "sine",
) {
  const ac = ctx();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + durationMs / 1000);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + durationMs / 1000);
}

function playFeedbackSound(kind: FeedbackKind) {
  switch (kind) {
    case "tap":
      tone(520, 45, 0.035);
      break;
    case "select":
      tone(660, 55, 0.04);
      setTimeout(() => tone(880, 40, 0.028), 30);
      break;
    case "confirm":
      tone(523, 60, 0.038);
      setTimeout(() => tone(784, 70, 0.032), 55);
      break;
  }
}

function haptic(kind: FeedbackKind) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  if (kind === "confirm") navigator.vibrate(18);
  else if (kind === "select") navigator.vibrate(12);
  else navigator.vibrate(8);
}

export function InteractionProvider({ children }: { children: ReactNode }) {
  const [soundsEnabled, setSoundsEnabledState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setSoundsEnabledState(stored === "on");
    setReady(true);
  }, []);

  const setSoundsEnabled = useCallback((enabled: boolean) => {
    setSoundsEnabledState(enabled);
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    if (enabled) playFeedbackSound("select");
  }, []);

  const feedback = useCallback(
    (kind: FeedbackKind = "tap") => {
      if (!ready) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      haptic(kind);
      if (soundsEnabled && !reducedMotion) playFeedbackSound(kind);
    },
    [ready, soundsEnabled],
  );

  const value = useMemo(
    () => ({ soundsEnabled, setSoundsEnabled, feedback }),
    [soundsEnabled, setSoundsEnabled, feedback],
  );

  return (
    <InteractionContext.Provider value={value}>
      {children}
    </InteractionContext.Provider>
  );
}

export function useInteractionFeedback() {
  const value = useContext(InteractionContext);
  if (!value) {
    return {
      soundsEnabled: false,
      setSoundsEnabled: () => {},
      feedback: () => {},
    };
  }
  return value;
}

/** Wraps a click handler with tap/select/confirm feedback. */
export function withFeedback(
  fn: () => void,
  feedback: (kind?: FeedbackKind) => void,
  kind: FeedbackKind = "tap",
) {
  return () => {
    feedback(kind);
    fn();
  };
}
