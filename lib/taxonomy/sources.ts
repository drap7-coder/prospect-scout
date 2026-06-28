/** Evidence source filter definitions — includes curated directory matches. */
export const TAXONOMY_SOURCE_FILTERS = [
  { id: "Directory", label: "Directory" },
  { id: "CMS", label: "CMS" },
  { id: "SEC", label: "SEC EDGAR" },
  { id: "FDA", label: "FDA" },
  { id: "RSS", label: "RSS / News" },
  { id: "Public Web", label: "Public Web" },
  { id: "Mock", label: "Directory" },
] as const;

export type TaxonomySourceFilterId = (typeof TAXONOMY_SOURCE_FILTERS)[number]["id"];

/** Human-readable labels for result summary source breakdown. */
export const SOURCE_SUMMARY_LABELS: Record<string, string> = {
  Directory: "Directory",
  CMS: "CMS",
  SEC: "SEC",
  FDA: "FDA",
  ERISA: "ERISA",
  RSS: "RSS",
  "Public Web": "Public Web",
  Mock: "Directory",
};
