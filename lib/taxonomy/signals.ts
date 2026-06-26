/** Signal-type filter definitions for results and search inference. */
export const TAXONOMY_SIGNAL_FILTERS = [
  { id: "leadership-change", label: "Leadership Change" },
  { id: "growth-expansion", label: "Growth / Expansion" },
  { id: "regulatory-pressure", label: "Regulatory Pressure" },
  { id: "fda-recall", label: "FDA Recall" },
  { id: "cms-enrollment", label: "CMS Enrollment Growth" },
  { id: "star-ratings", label: "Star Ratings Pressure" },
  { id: "sec-filing", label: "SEC Filing Event" },
  { id: "hiring", label: "Hiring" },
  { id: "partnership-acquisition", label: "Partnership / Acquisition" },
] as const;

export type TaxonomySignalFilterId = (typeof TAXONOMY_SIGNAL_FILTERS)[number]["id"];
