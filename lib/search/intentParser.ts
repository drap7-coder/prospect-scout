import type {
  BuyerPackId,
  IntentParser,
  RawSearchInput,
  SearchQuery,
  UserProfile,
} from "@/lib/search/types";
import { isBuyerPackId } from "@/lib/packs";
import { normalizeRegion, inferRegionFromText, ANY_REGION } from "./regions";
import { inferIdealSignals } from "./capabilities";

/**
 * Heuristic intent parser.
 *
 * Turns free text into a structured `UserProfile`: it infers the buyer pack,
 * the region, and the seller's capability (as ideal signals), and extracts
 * any excluded targets. No external LLM is used. The `HeuristicIntentParser`
 * implements the `IntentParser` interface, so an LLM-backed parser can be
 * dropped in later without touching the downstream pipeline.
 *
 * Supported example queries:
 *   "I help regional health plans reduce specialty drug spend in the Mid-Atlantic"
 *   "Find food manufacturers that may need packaging automation"
 *   "Show public employers with benefits cost pressure"
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
      "idn",
      "medical center",
      "provider",
      "clinic",
      "340b",
    ],
  ],
  [
    "manufacturers",
    [
      "manufacturer",
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
    ],
  ],
  [
    "public-sector",
    [
      "municipal",
      "municipality",
      "government",
      "public sector",
      "public employer",
      "city",
      "county",
      "state agency",
      "school district",
      "rfp",
    ],
  ],
  [
    "employers",
    [
      "employer",
      "self-insured",
      "self insured",
      "workforce",
      "benefits",
      "company",
      "business",
    ],
  ],
];

function guessBuyerPack(text: string): BuyerPackId {
  const haystack = text.toLowerCase();
  for (const [packId, keywords] of PACK_KEYWORDS) {
    if (keywords.some((kw) => haystack.includes(kw))) {
      return packId;
    }
  }
  // Sensible default: health plans is the flagship ecosystem for the MVP.
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
