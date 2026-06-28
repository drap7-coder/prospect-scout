import {
  loadResultDensity,
  saveResultDensity,
  type ResultDensity,
} from "./resultDensity";

export type ResultsDisplayMode = "browse" | "list" | "table";

const STORAGE_KEY = "prospect-scout-results-view";

export const RESULTS_VIEW_OPTIONS: { id: ResultsDisplayMode; label: string }[] =
  [
    { id: "browse", label: "Browse" },
    { id: "list", label: "List" },
    { id: "table", label: "Table" },
  ];

export function loadResultsDisplayMode(): ResultsDisplayMode {
  if (typeof window === "undefined") return "browse";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "browse" || stored === "list" || stored === "table") {
    return stored;
  }
  // Legacy keys from prior view toggle.
  if (stored === "cards" || stored === "compact") return "browse";
  return loadResultDensity() === "compact" ? "list" : "browse";
}

export function saveResultsDisplayMode(mode: ResultsDisplayMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, mode);
  if (mode === "browse") {
    saveResultDensity("comfortable");
  } else if (mode === "list") {
    saveResultDensity("compact");
  }
}

export function displayModeToDensity(mode: ResultsDisplayMode): ResultDensity {
  return mode === "list" ? "compact" : "comfortable";
}
