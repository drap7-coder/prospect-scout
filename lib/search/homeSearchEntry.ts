import { EMPTY_SEARCH_STATE, searchStateToParams } from "./searchState";

/** Build the /results URL for a homepage text search (reuses standard search state). */
export function homeQueryToResultsUrl(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "/results";
  return `/results?${searchStateToParams({ ...EMPTY_SEARCH_STATE, query: trimmed }).toString()}`;
}
