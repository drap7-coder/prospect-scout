/**
 * Region buckets shared by the RegionSelector UI, the heuristic parser, and
 * the mock data provider. Keeping a single source of truth here means a real
 * geocoding/Census provider can later map raw locations onto the same buckets.
 */

export interface Region {
  /** Canonical value stored on SearchQuery and RawProspect. */
  id: string;
  label: string;
  /** Lowercased aliases the heuristic parser will recognize in free text. */
  aliases: string[];
}

export const ANY_REGION = "any";

export const regions: Region[] = [
  {
    id: "northeast",
    label: "Northeast",
    aliases: ["northeast", "new england", "ne"],
  },
  {
    id: "mid-atlantic",
    label: "Mid-Atlantic",
    aliases: [
      "mid-atlantic",
      "mid atlantic",
      "midatlantic",
      "pennsylvania",
      "pa",
      "new jersey",
      "nj",
      "maryland",
      "md",
      "delaware",
      "virginia",
      "va",
    ],
  },
  {
    id: "southeast",
    label: "Southeast",
    aliases: ["southeast", "south east", "se", "florida", "georgia", "carolina"],
  },
  {
    id: "midwest",
    label: "Midwest",
    aliases: ["midwest", "mid west", "great lakes", "ohio", "illinois", "michigan"],
  },
  {
    id: "southwest",
    label: "Southwest",
    aliases: ["southwest", "south west", "texas", "arizona", "new mexico"],
  },
  {
    id: "west",
    label: "West",
    aliases: ["west", "pacific", "california", "ca", "oregon", "washington"],
  },
];

/** Normalize an arbitrary region string to a canonical region id. */
export function normalizeRegion(input?: string): string {
  if (!input) return ANY_REGION;
  const value = input.trim().toLowerCase();
  if (!value || value === ANY_REGION || value === "anywhere") return ANY_REGION;

  const exact = regions.find((r) => r.id === value || r.label.toLowerCase() === value);
  if (exact) return exact.id;

  const aliased = regions.find((r) => r.aliases.some((a) => value.includes(a)));
  return aliased ? aliased.id : ANY_REGION;
}

export function regionLabel(id: string): string {
  if (id === ANY_REGION) return "Anywhere";
  return regions.find((r) => r.id === id)?.label ?? id;
}

/**
 * Scan free text for any region alias and return the first matching region
 * id, or ANY_REGION if none is found. Used by the intent parser to pull a
 * geography out of a natural-language query.
 */
export function inferRegionFromText(text?: string): string {
  if (!text) return ANY_REGION;
  const value = text.toLowerCase();
  for (const region of regions) {
    if (value.includes(region.label.toLowerCase())) {
      return region.id;
    }
    if (
      region.aliases.some((a) =>
        new RegExp(`\\b${escapeRegExp(a)}\\b`).test(value),
      )
    ) {
      return region.id;
    }
  }
  return ANY_REGION;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
