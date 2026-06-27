export type ResultDensity = "comfortable" | "compact";

const STORAGE_KEY = "prospect-scout-result-density";

export function loadResultDensity(): ResultDensity {
  if (typeof window === "undefined") return "comfortable";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "compact" || stored === "comfortable") {
    return stored;
  }
  return "comfortable";
}

export function saveResultDensity(density: ResultDensity): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, density);
}

export const DENSITY_OPTIONS: { id: ResultDensity; label: string }[] = [
  { id: "comfortable", label: "Comfortable" },
  { id: "compact", label: "Compact" },
];
