import type { SearchIntent } from "@/lib/discovery/intent";
import type { ErisaQueryConstraints } from "./types";

const STATE_NAMES: Record<string, string> = {
  pennsylvania: "PA",
  ohio: "OH",
  california: "CA",
  texas: "TX",
  florida: "FL",
  "new york": "NY",
};

/** Infer ERISA-specific filters from query text (Form 5500 sponsor search). */
export function parseErisaQueryConstraints(
  intent: SearchIntent,
): ErisaQueryConstraints {
  const hay = intent.query.toLowerCase();
  let state = intent.state;

  if (!state) {
    for (const [name, code] of Object.entries(STATE_NAMES)) {
      if (new RegExp(`\\b(in|near)?\\s*${name}\\b`).test(hay)) {
        state = code;
        break;
      }
    }
    const abbr = hay.match(/\b(in|near)\s+([a-z]{2})\b/);
    if (abbr?.[2]) state = abbr[2].toUpperCase();
  }

  const selfFundedOnly = /\bself[- ]?fund(ed|ing)?\b/.test(hay);

  let minParticipants: number | null = null;
  const overMatch = hay.match(
    /\b(?:over|more than|above|at least|>=?)\s*([\d,]+)\s+participants?\b/,
  );
  if (overMatch?.[1]) {
    minParticipants = Number(overMatch[1].replace(/,/g, ""));
  }
  const largeEmployerMatch = hay.match(
    /\blarge employers?\b.*?\b([\d,]+)\s+participants?\b/,
  );
  if (largeEmployerMatch?.[1]) {
    minParticipants = Number(largeEmployerMatch[1].replace(/,/g, ""));
  }

  const employerFocused =
    /\b(employer|employers|plan sponsor|benefits buyer|self[- ]?fund)\b/.test(
      hay,
    ) ||
    intent.organizationTypeId === "employer" ||
    intent.sectorId === "employers";

  return {
    state: state ?? null,
    selfFundedOnly,
    minParticipants:
      minParticipants != null && Number.isFinite(minParticipants)
        ? minParticipants
        : null,
    employerFocused,
  };
}
