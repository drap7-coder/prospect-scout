"use client";

import { useInteractionFeedback } from "./InteractionProvider";

export function SoundToggle() {
  const { soundsEnabled, setSoundsEnabled } = useInteractionFeedback();

  return (
    <button
      type="button"
      onClick={() => setSoundsEnabled(!soundsEnabled)}
      aria-label={soundsEnabled ? "Turn sound off" : "Turn sound on"}
      aria-pressed={soundsEnabled}
      className="interactive-icon-btn"
      title={soundsEnabled ? "Sound on" : "Sound off"}
    >
      {soundsEnabled ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M11 5 6 9H3v6h3l5 4V5Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path
            d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M11 5 6 9H3v6h3l5 4V5Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path d="m16 9 5 5M21 9l-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
