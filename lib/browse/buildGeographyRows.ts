import type { Prospect } from "@/lib/search/types";
import type { BrowseGroupSpec, BrowseRow } from "./types";
import { buildRowsFromSpecs } from "./buildCategoryRows";

const US_REGIONS: { id: string; label: string; states: string[] }[] = [
  {
    id: "northeast",
    label: "Northeast",
    states: ["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA"],
  },
  {
    id: "southeast",
    label: "Southeast",
    states: [
      "DE",
      "MD",
      "DC",
      "VA",
      "WV",
      "NC",
      "SC",
      "GA",
      "FL",
      "KY",
      "TN",
      "AL",
      "MS",
      "AR",
      "LA",
    ],
  },
  {
    id: "midwest",
    label: "Midwest",
    states: [
      "OH",
      "MI",
      "IN",
      "IL",
      "WI",
      "MN",
      "IA",
      "MO",
      "ND",
      "SD",
      "NE",
      "KS",
    ],
  },
  {
    id: "southwest",
    label: "Southwest",
    states: ["TX", "OK", "NM", "AZ"],
  },
  {
    id: "west",
    label: "West",
    states: ["CO", "WY", "MT", "ID", "UT", "NV", "CA", "OR", "WA", "AK", "HI"],
  },
];

function statesForProspect(p: Prospect): string[] {
  return p.stateCodes ?? (p.stateCode ? [p.stateCode] : []);
}

const GEOGRAPHY_SPECS: BrowseGroupSpec[] = [
  {
    id: "geo-national",
    title: "National",
    description: "National or multi-state footprint",
    order: 0,
    match: (p) =>
      p.geographyNational === true || (p.stateCodes?.length ?? 0) >= 15,
    viewAll: {
      label: "View national organizations",
      filterPatch: { location: "nationwide" },
    },
  },
  ...US_REGIONS.map((r, i) => ({
    id: `geo-${r.id}`,
    title: r.label,
    description: `${r.label} region`,
    order: i + 1,
    match: (p: Prospect) => {
      const states = statesForProspect(p);
      return states.some((s) => r.states.includes(s));
    },
    viewAll: {
      label: `View ${r.label}`,
      filterPatch: { location: r.id },
    },
  })),
];

export function buildGeographyRows(prospects: Prospect[]): BrowseRow[] {
  const rows = buildRowsFromSpecs(GEOGRAPHY_SPECS, prospects);

  const stateCounts = new Map<string, number>();
  for (const p of prospects) {
    for (const st of statesForProspect(p)) {
      stateCounts.set(st, (stateCounts.get(st) ?? 0) + 1);
    }
  }
  const topStates = [...stateCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const stateSpecs: BrowseGroupSpec[] = topStates.map(([state, count], i) => ({
    id: `geo-state-${state}`,
    title: state,
    description: `${count} organization${count === 1 ? "" : "s"}`,
    order: 100 + i,
    match: (p) => statesForProspect(p).includes(state),
    viewAll: {
      label: `View all in ${state}`,
      filterPatch: { state },
    },
  }));

  return [...rows, ...buildRowsFromSpecs(stateSpecs, prospects)];
}
