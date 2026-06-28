import {
  loadResultDensity,
  saveResultDensity,
  type ResultDensity,
} from "./resultDensity";
import type { BrowseLensId } from "@/lib/browse/types";
import { defaultBrowseLens } from "@/lib/browse/buildBrowseRows";

export type ResultsDisplayMode = "browse" | "list" | "table";

const VIEW_STORAGE_KEY = "prospect-scout-results-view";
const LENS_STORAGE_KEY = "prospect-scout-browse-lens";

export const RESULTS_VIEW_OPTIONS: { id: ResultsDisplayMode; label: string }[] =
  [
    { id: "browse", label: "Browse" },
    { id: "list", label: "List" },
    { id: "table", label: "Table" },
  ];

export function loadResultsDisplayMode(): ResultsDisplayMode {
  if (typeof window === "undefined") return "browse";
  const stored = localStorage.getItem(VIEW_STORAGE_KEY);
  if (stored === "browse" || stored === "list" || stored === "table") {
    return stored;
  }
  if (stored === "cards" || stored === "compact") return "browse";
  return loadResultDensity() === "compact" ? "list" : "browse";
}

export function saveResultsDisplayMode(mode: ResultsDisplayMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VIEW_STORAGE_KEY, mode);
  if (mode === "browse") {
    saveResultDensity("comfortable");
  } else if (mode === "list") {
    saveResultDensity("compact");
  }
}

export function loadBrowseLens(): BrowseLensId {
  if (typeof window === "undefined") return defaultBrowseLens();
  const stored = localStorage.getItem(LENS_STORAGE_KEY);
  if (
    stored === "category" ||
    stored === "geography" ||
    stored === "opportunity" ||
    stored === "alphabet"
  ) {
    return stored;
  }
  return defaultBrowseLens();
}

export function saveBrowseLens(lens: BrowseLensId): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LENS_STORAGE_KEY, lens);
}

export function displayModeToDensity(mode: ResultsDisplayMode): ResultDensity {
  return mode === "list" ? "compact" : "comfortable";
}
