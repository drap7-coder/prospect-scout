import type {
  Prospect,
  RawProspect,
  ScoreBreakdown,
  SearchQuery,
} from "@/lib/search/types";
import {
  industryLabel,
  organizationTypeLabel,
  sectorLabel,
} from "@/lib/taxonomy";
import { regionLabel } from "@/lib/search/regions";
import { ANY_REGION } from "@/lib/search/regions";

const SIZE_LABELS: Record<string, string> = {
  small: "Small organization",
  mid: "Mid-market organization",
  large: "Large organization",
  enterprise: "Enterprise-scale organization",
};

function humanizeDiscoveryCode(code: string): string | null {
  if (code.startsWith("orgType:")) {
    const id = code.slice("orgType:".length);
    if (id === "mismatch") return null;
    return `${organizationTypeLabel(id)} organization type`;
  }
  if (code.startsWith("industry:")) {
    const id = code.slice("industry:".length);
    if (id === "mismatch") return null;
    return `${industryLabel(id)} industry match`;
  }
  if (code.startsWith("sector:")) {
    const rest = code.slice("sector:".length);
    if (rest === "incompatible" || rest === "mismatch") return null;
    if (rest.startsWith("alternate:")) {
      return `${sectorLabel(rest.slice("alternate:".length))} sector (related)`;
    }
    return `${sectorLabel(rest)} sector match`;
  }
  if (code.startsWith("state:")) {
    return `Located in ${code.slice("state:".length)}`;
  }
  if (code.startsWith("state-proximity:")) {
    return `Operates in ${code.slice("state-proximity:".length)}`;
  }
  if (code.startsWith("city:")) {
    const city = code.slice("city:".length);
    return `Headquartered near ${city}`;
  }
  if (code.startsWith("region:")) {
    return `In ${regionLabel(code.slice("region:".length))} region`;
  }
  if (code === "exact:query-in-name") return "Name matches your search query";
  if (code.startsWith("keywords:")) {
    const kws = code.slice("keywords:".length).split(",");
    return `Keyword match: ${kws.slice(0, 3).join(", ")}`;
  }
  if (code === "source:authoritative") return "Verified public registry record";
  if (code === "source:enrichment-only") return null;
  return null;
}

function reasonsFromScoreBreakdown(breakdown: ScoreBreakdown): string[] {
  return breakdown.factors
    .filter((f) => f.points > 0 && f.key !== "structurePenalty")
    .sort((a, b) => b.points - a.points)
    .slice(0, 4)
    .map((f) => f.detail);
}

function reasonsFromProspectMetadata(
  prospect: RawProspect,
  query: SearchQuery,
): string[] {
  const reasons: string[] = [];

  if (prospect.publicCompany === true) reasons.push("Public company (SEC eligible)");
  if (prospect.publicCompany === false) reasons.push("Private company");
  if (prospect.sectorId === "nonprofit" || prospect.industryId === "nonprofit") {
    reasons.push("Nonprofit organization");
  }
  if (prospect.directoryMatch) reasons.push("In verified organization catalog");
  if (prospect.size) reasons.push(SIZE_LABELS[prospect.size] ?? "Known organization size");
  if (prospect.employeeEstimate && prospect.employeeEstimate >= 1000) {
    reasons.push(`~${prospect.employeeEstimate.toLocaleString()} employees`);
  }

  if (
    query.profile.region !== ANY_REGION &&
    prospect.region === query.profile.region
  ) {
    reasons.push(`In your target region (${regionLabel(query.profile.region)})`);
  }

  return reasons;
}

/** Builds trust-oriented "why did I get this?" bullets for result cards. */
export function buildMatchReasons(
  prospect: RawProspect,
  query: SearchQuery,
  breakdown: ScoreBreakdown,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  function add(text: string | null | undefined) {
    const t = text?.trim();
    if (!t || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push(t);
  }

  for (const code of prospect.discoveryMatchReasons ?? []) {
    add(humanizeDiscoveryCode(code));
  }

  for (const detail of reasonsFromScoreBreakdown(breakdown)) {
    add(detail);
  }

  for (const meta of reasonsFromProspectMetadata(prospect, query)) {
    add(meta);
  }

  if (out.length === 0) {
    add("Matched your search criteria and signal profile");
  }

  return out.slice(0, 6);
}

/** One-line summary for compact card mode. */
export function primaryMatchReason(prospect: Prospect): string {
  return prospect.matchReasons[0] ?? "Matched your search";
}
