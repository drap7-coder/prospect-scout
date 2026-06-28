import {
  loadResultDensity,
  saveResultDensity,
  type ResultDensity,
} from "./resultDensity";

export type ResultsDisplayMode = "cards" | "compact" | "table";

const STORAGE_KEY = "prospect-scout-results-view";

export const RESULTS_VIEW_OPTIONS: { id: ResultsDisplayMode; label: string }[] =
  [
    { id: "cards", label: "Cards" },
    { id: "compact", label: "Compact" },
    { id: "table", label: "Table" },
  ];

export function loadResultsDisplayMode(): ResultsDisplayMode {
  if (typeof window === "undefined") return "cards";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (
    stored === "cards" ||
    stored === "compact" ||
    stored === "table"
  ) {
    return stored;
  }
  return loadResultDensity() === "compact" ? "compact" : "cards";
}

export function saveResultsDisplayMode(mode: ResultsDisplayMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, mode);
  if (mode === "cards") {
    saveResultDensity("comfortable");
  } else if (mode === "compact") {
    saveResultDensity("compact");
  }
}

export function displayModeToDensity(mode: ResultsDisplayMode): ResultDensity {
  return mode === "compact" ? "compact" : "comfortable";
}
