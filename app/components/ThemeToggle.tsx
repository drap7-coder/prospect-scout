"use client";

import { useEffect, useState } from "react";
import { useInteractionFeedback } from "./InteractionProvider";

const STORAGE_KEY = "prospect-scout-theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);
  const { feedback } = useInteractionFeedback();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefersDark =
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", prefersDark);
    setDark(prefersDark);
    setReady(true);
  }, []);

  function toggle() {
    feedback("select");
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  }

  if (!ready) {
    return (
      <span
        className="inline-block h-9 w-9 rounded-full border border-border bg-surface"
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="interactive-icon-btn"
    >
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21 14.5A7.5 7.5 0 0 1 9.5 3 9.5 9.5 0 1 0 21 14.5Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
