import type { Prospect } from "@/lib/search/types";
import type { BrowseGroupSpec } from "./types";
import { buildRowsFromSpecs } from "./buildCategoryRows";

const OPPORTUNITY_SPECS: BrowseGroupSpec[] = [
  {
    id: "opp-high",
    title: "High Opportunity",
    description: "Top opportunity scores in this result set",
    order: 0,
    match: (p) => p.score >= 65,
    viewAll: { label: "View high opportunity", filterPatch: { sort: "score" } },
  },
  {
    id: "opp-growing",
    title: "Growing",
    description: "Growth and expansion signals",
    order: 1,
    match: (p) =>
      p.signals.some((s) =>
        /growth|expan|enrollment|merger|acquisition/i.test(`${s.label}${s.type}`),
      ),
    viewAll: {
      label: "View growing organizations",
      filterPatch: { signals: ["growth-expansion"] },
    },
  },
  {
    id: "opp-recently-expanded",
    title: "Recently Expanded",
    description: "Recent footprint or capacity expansion",
    order: 2,
    match: (p) =>
      p.signals.some((s) => /expan|new facility|footprint|launch/i.test(s.label)),
    viewAll: { label: "View recently expanded", filterPatch: {} },
  },
  {
    id: "opp-regulatory",
    title: "Recent Regulatory Activity",
    description: "Regulatory, CMS, or compliance pressure",
    order: 3,
    match: (p) =>
      p.signals.some((s) =>
        /regulat|cms|fda|compliance|340b|star rating/i.test(
          `${s.label} ${s.source}`,
        ),
      ),
    viewAll: {
      label: "View regulatory activity",
      filterPatch: { signals: ["regulatory-pressure"] },
    },
  },
  {
    id: "opp-large-lives",
    title: "Large Covered Lives",
    description: "High enrollment or member volume",
    order: 4,
    match: (p) => (p.coveredLives ?? 0) >= 500_000,
    viewAll: { label: "View large payers", filterPatch: { sort: "size" } },
  },
  {
    id: "opp-executive",
    title: "Recent Executive Changes",
    description: "Leadership transitions and hiring signals",
    order: 5,
    match: (p) =>
      p.signals.some((s) =>
        /leadership|executive|ceo|cfo|chief|president|hiring/i.test(s.label),
      ),
    viewAll: {
      label: "View leadership changes",
      filterPatch: { signals: ["leadership-change"] },
    },
  },
  {
    id: "opp-confidence",
    title: "High Confidence",
    description: "Strong warehouse verification confidence",
    order: 6,
    match: (p) => (p.discoveryConfidence ?? 0) >= 0.85,
    viewAll: { label: "View high confidence", filterPatch: {} },
  },
];

export function buildOpportunityRows(prospects: Prospect[]) {
  return buildRowsFromSpecs(OPPORTUNITY_SPECS, prospects);
}
