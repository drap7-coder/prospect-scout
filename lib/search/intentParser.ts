import type {
  BuyerPackId,
  IntentParser,
  RawSearchInput,
  SearchQuery,
  UserProfile,
} from "@/lib/search/types";
import { isBuyerPackId } from "@/lib/packs";
import { inferTaxonomyFromQuery } from "@/lib/taxonomy";
import { parseSearchIntent } from "@/lib/discovery/intent";
import { normalizeRegion, inferRegionFromText, ANY_REGION } from "./regions";
import { inferIdealSignals } from "./capabilities";

/**
 * Heuristic intent parser.
 *
 * Turns free text into a structured `UserProfile`: it infers the taxonomy target,
 * region, optional capability signals, and excluded targets.
 */

/** Keyword cues that hint at each buyer pack. Order encodes priority. */
const PACK_KEYWORDS: [BuyerPackId, string[]][] = [
  [
    "health-plans",
    [
      "health plan",
      "payer",
      "payor",
      "medicare",
      "medicaid",
      "managed care",
      "insurer",
      "mco",
      "pbm",
    ],
  ],
  [
    "health-systems",
    [
      "health system",
      "hospital",
      "hospitals",
      "idn",
      "medical center",
      "physician group",
      "340b",
    ],
  ],
  [
    "manufacturers",
    [
      "manufacturer",
      "manufacturers",
      "manufacturing",
      "plant",
      "factory",
      "production",
      "cpg",
      "packaging",
      "industrial",
      "device maker",
      "food",
      "beverage",
      "pepsi",
      "pepsico",
    ],
  ],
  [
    "public-sector",
    [
      "municipal",
      "municipality",
      "municipalities",
      "government",
      "public sector",
      "public employer",
      "city of",
      "county",
      "state agency",
      "school district",
      "transit authority",
      "rfp",
    ],
  ],
  [
    "employers",
    [
      "bank",
      "banks",
      "credit union",
      "university",
      "universities",
      "college",
      "employer",
      "self-insured",
      "self insured",
      "workforce",
      "benefits",
      "fintech",
      "consulting firm",
      "law firm",
    ],
  ],
];

function guessBuyerPack(text: string): BuyerPackId {
  const taxonomy = inferTaxonomyFromQuery(text);
  if (taxonomy.taxonomyTarget) return taxonomy.taxonomyTarget;

  const haystack = text.toLowerCase();
  for (const [packId, keywords] of PACK_KEYWORDS) {
    if (keywords.some((kw) => haystack.includes(kw))) {
      return packId;
    }
  }
  return "health-plans";
}

/** Pull "excluding X, Y" / "except X" / "not including X" fragments. */
function extractExclusions(text: string): string[] {
  const exclusions: string[] = [];
  const patterns = [
    /(?:excluding|except|not including|but not)\s+([a-z0-9 ,&/-]+)/gi,
  ];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      const chunk = m[1];
      for (const part of chunk.split(/,|\band\b/)) {
        const term = part.trim().replace(/[.;:]+$/, "");
        // Keep it short — a stray clause shouldn't swallow the sentence.
        if (term && term.split(/\s+/).length <= 4) exclusions.push(term);
      }
    }
  }
  return [...new Set(exclusions)];
}

export class HeuristicIntentParser implements IntentParser {
  parse(input: RawSearchInput): SearchQuery {
    const sells = (input.sells ?? input.sellerContext ?? "").trim();
    const targets = (input.targets ?? input.query ?? "").trim();
    const combined = `${sells} ${targets}`.trim() || targets;

    // Buyer pack: explicit UI selection wins; otherwise infer from text.
    const explicitPack =
      typeof input.buyerPack === "string" && isBuyerPackId(input.buyerPack)
        ? (input.buyerPack as BuyerPackId)
        : undefined;
    const targetBuyer = explicitPack ?? guessBuyerPack(combined);

    // Region: explicit select wins; otherwise infer from free text.
    let region = normalizeRegion(input.region);
    if (region === ANY_REGION) {
      region = inferRegionFromText(combined);
    }

    // Capability → ideal signals, scoped to the chosen pack.
    const idealSignals = inferIdealSignals(combined, targetBuyer);

    const structured = parseSearchIntent(combined, {
      sectorId: input.sectorId ?? undefined,
      industryId: input.industryId ?? undefined,
      organizationTypeId: input.organizationTypeId ?? undefined,
      state: input.state ?? undefined,
      classificationNamespace: input.classificationNamespace ?? undefined,
      classificationId: input.classificationId ?? undefined,
      region: input.region,
    });
    const sectorId = structured.sectorId;
    const industryId = structured.industryId;
    const organizationTypeId = structured.organizationTypeId;
    const state = structured.state;

    // Exclusions: explicit input plus anything parsed from the text.
    const excludedTargets = [
      ...(input.excludedTargets ?? []),
      ...extractExclusions(combined),
    ].map((t) => t.toLowerCase());

    const profile: UserProfile = {
      whatTheySell: sells,
      targetBuyer,
      region,
      idealSignals,
      excludedTargets: [...new Set(excludedTargets)],
      sectorId,
      industryId,
      organizationTypeId,
      state,
    };

    return {
      profile,
      targets,
      raw: {
        query: input.query,
        sells: input.sells ?? "",
        buyerPack: input.buyerPack,
        targets: input.targets ?? input.query,
        region: input.region,
        sellerContext: input.sellerContext,
        excludedTargets: input.excludedTargets,
        sectorId,
        industryId,
        organizationTypeId,
        state,
      },
    };
  }
}

/** Default parser instance used by the pipeline. */
export const intentParser: IntentParser = new HeuristicIntentParser();

/** Convenience wrapper. */
export function parseIntent(input: RawSearchInput): SearchQuery {
  return intentParser.parse(input);
}
