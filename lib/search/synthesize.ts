import type {
  BuyerPack,
  Prospect,
  ProspectSignal,
  RawProspect,
  ScoreBreakdown,
  SearchQuery,
  SourceTrailItem,
} from "@/lib/search/types";
import { displayOrganizationType, organizationTypeLabel } from "@/lib/taxonomy";
import { ANY_REGION, regionLabel } from "./regions";

/**
 * Turns a scored raw prospect (plus its enriched signals) into a render-ready
 * `Prospect`: the strategic "why it matters", the timing-focused "why now",
 * the provenance "source trail", and a concrete outreach angle.
 *
 * Today this is rule/template-based. The same signature would let an LLM
 * generate richer narratives later from the structured inputs, without
 * changing the API or UI.
 */

/** Concise strategic implication per signal (the "why it matters" framing). */
const SIGNAL_WHY: Record<string, string> = {
  "medicare-growth": "Growing Medicare book raises pharmacy and clinical stakes",
  "pharmacy-leadership-change":
    "New pharmacy leadership is often open to fresh strategy",
  "pbm-transition-risk": "PBM transition risk creates urgency around cost control",
  "specialty-drug-exposure":
    "Specialty drug exposure pressures trend and net cost",
  "star-ratings-pressure": "Star Ratings pressure drives investment in outcomes",
  "recent-acquisition": "Recent acquisition means integration and vendor review",
  "regulatory-pressure": "Regulatory pressure forces near-term compliance moves",
  "plant-expansion": "Plant expansion opens capacity and equipment decisions",
  "new-product-launch": "New product launch reshapes packaging and supply needs",
  "recall-activity": "Recall activity exposes quality and process gaps",
  "sustainability-initiative":
    "Sustainability goals trigger materials and process change",
  "packaging-engineer-hiring":
    "Packaging engineer hiring signals active line investment",
  "automation-investment": "Automation investment indicates capital is flowing",
  "multi-site-operations": "Multi-site operations multiply standardization needs",
  "merger-activity": "Merger activity forces consolidation of systems and vendors",
  "specialty-pharmacy-growth":
    "Specialty pharmacy growth raises margin and risk stakes",
  "340b-exposure": "340B exposure makes program optimization high value",
  "cost-pressure": "Cost pressure sharpens appetite for savings",
  "new-executive-hire": "New executive often re-evaluates partners and priorities",
  "service-line-expansion": "Service line expansion creates new capability gaps",
  "large-employee-base": "Large employee base magnifies benefits spend",
  "benefits-cost-pressure": "Benefits cost pressure motivates plan redesign",
  "union-workforce": "Union workforce adds complexity to benefits decisions",
  "multi-state-footprint": "Multi-state footprint complicates compliance and plans",
  "recent-growth": "Recent growth strains existing benefits and HR programs",
  "rfp-activity": "Active RFP means a defined, time-boxed buying window",
  "budget-cycle": "Budget cycle timing aligns with new funding decisions",
  "employee-benefits-pressure":
    "Employee benefits pressure pushes procurement to act",
  "procurement-timing": "Procurement timing favors early, informed engagement",
  "regulatory-requirements": "Regulatory requirements mandate compliant solutions",
  "cms-ma-enrollment-growth": "Growing MA enrollment raises pharmacy and bid-season stakes",
  "cms-star-ratings-pressure": "Star Ratings pressure drives investment in outcomes",
  "cms-part-d-exposure": "Part D exposure amplifies formulary and trend risk",
  "cms-regional-plan-presence": "Multi-state footprint multiplies coordination needs",
  "cms-contract-concentration": "Multiple contracts create enterprise program leverage",
  "cms-parent-org-relationship": "Parent org oversight drives enterprise vendor decisions",
  "rss-leadership-change": "Public leadership news often opens the door to new strategy",
  "rss-acquisition-merger": "M&A press releases reopen vendor and integration decisions",
  "rss-expansion": "Expansion announcements signal new investment and capacity needs",
  "rss-new-product-launch": "Product launches reshape supply, packaging, and program needs",
  "rss-contract-award": "Contract awards create a defined delivery and buying window",
  "rss-partnership": "Partnership news often precedes program realignment",
  "rss-regulatory-issue": "Regulatory press coverage forces near-term compliance action",
  "rss-hiring-workforce": "Workforce growth signals budget flowing toward people and programs",
  "rss-cost-pressure": "Public cost pressure sharpens appetite for savings",
  "fda-food-recall": "Food recalls force rapid corrective action and supplier review",
  "fda-drug-recall": "Drug recalls trigger compliance remediation and supply disruption",
  "fda-device-recall": "Device recalls create urgent clinical supply and liability pressure",
  "fda-manufacturing-quality": "Quality deviations expose process gaps and remediation spend",
  "fda-labeling-issue": "Labeling errors force relabeling and compliance corrections",
  "fda-packaging-contamination": "Packaging or contamination events demand immediate containment",
  "fda-regulatory-pressure": "FDA enforcement sharpens appetite for compliance investment",
  "fda-product-safety": "Product safety events elevate risk management urgency",
  "web-expansion": "Public expansion language signals new investment and capacity needs",
  "web-hiring": "Active hiring on public pages indicates staffing and program investment",
  "web-leadership-change": "Leadership pages mentioning new executives open vendor review windows",
  "web-acquisition": "M&A language on public pages suggests integration and vendor realignment",
  "web-new-product-service": "New offerings on public pages reshape supply and program needs",
  "web-sustainability": "Sustainability goals on public pages trigger materials and process change",
  "web-regulatory-compliance": "Compliance language signals near-term regulatory investment",
  "web-packaging-automation": "Packaging and automation mentions indicate active line investment",
  "web-pharmacy-pbm-specialty": "Pharmacy and PBM language signals formulary and trend management focus",
};

function capitalize(text: string): string {
  return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text;
}

function buildWhyItMatters(
  signals: ProspectSignal[],
  query: SearchQuery,
  prospect: RawProspect,
  pack: BuyerPack,
): string[] {
  const why: string[] = [];

  for (const signal of signals.slice(0, 3)) {
    why.push(SIGNAL_WHY[signal.id] ?? `${signal.label} indicates active opportunity`);
  }

  const matchesFocus =
    query.profile.idealSignals.length > 0 &&
    signals.some((s) => query.profile.idealSignals.includes(s.id));
  if (matchesFocus && query.profile.whatTheySell) {
    why.push(`Directly matches what you sell: ${query.profile.whatTheySell}`);
  }

  if (
    query.profile.region !== ANY_REGION &&
    prospect.region === query.profile.region
  ) {
    why.push(
      `Located in your selected territory (${regionLabel(query.profile.region)})`,
    );
  }

  if (why.length === 0) {
    why.push(`Established ${pack.label.toLowerCase()} buyer in your target market`);
  }

  return why.slice(0, 5);
}

function buildWhyNow(signals: ProspectSignal[]): string {
  if (signals.length === 0) {
    return "No time-sensitive trigger detected yet — worth monitoring.";
  }
  const top = signals[0];
  return `${capitalize(top.whyNow)} — ${top.strength} signal observed ~${top.freshnessDays}d ago via ${top.source}.`;
}

function buildOutreachAngle(
  signals: ProspectSignal[],
  query: SearchQuery,
  pack: BuyerPack,
): string {
  if (signals.length === 0) {
    const offering = query.profile.whatTheySell.trim();
    return offering
      ? `Position ${offering} around their current priorities and a relevant proof point.`
      : `Lead with the most relevant ${pack.label.toLowerCase()} priorities and a proof point.`;
  }

  const top = signals[0];
  // If a second strong-ish signal exists, reinforce the lead with it.
  const second = signals[1];
  if (second && second.urgency >= 0.6) {
    return `${top.suggestedAction}; reinforce with ${second.label.toLowerCase()}.`;
  }
  return `${top.suggestedAction}.`;
}

function buildSourceTrail(
  signals: ProspectSignal[],
  prospect: RawProspect,
): SourceTrailItem[] {
  const seen = new Set<string>();
  const trail: SourceTrailItem[] = [];
  for (const signal of signals) {
    const key = `${signal.source}|${signal.evidenceText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    trail.push({ source: signal.source, evidenceText: signal.evidenceText });
  }
  if (prospect.directoryMatch && trail.length === 0) {
    trail.push({
      source: "Directory",
      evidenceText: "Master directory · curated organization record",
    });
  }
  return trail;
}

export function synthesizeProspect(
  prospect: RawProspect,
  signals: ProspectSignal[],
  query: SearchQuery,
  pack: BuyerPack,
  breakdown: ScoreBreakdown,
): Prospect {
  const buyerType = prospect.organizationTypeId
    ? organizationTypeLabel(prospect.organizationTypeId)
    : displayOrganizationType(prospect.buyerPack);

  return {
    id: prospect.id,
    name: prospect.name,
    location: prospect.location,
    region: prospect.region,
    buyerType,
    buyerPack: prospect.buyerPack,
    score: breakdown.total,
    scoreBreakdown: breakdown,
    whyItMatters: buildWhyItMatters(signals, query, prospect, pack),
    signals,
    whyNow: buildWhyNow(signals),
    sourceTrail: buildSourceTrail(signals, prospect),
    outreachAngle: buildOutreachAngle(signals, query, pack),
    contactRoles: pack.contactRoles.slice(0, 4),
    size: prospect.size,
    sectorId: prospect.sectorId,
    industryId: prospect.industryId,
    organizationTypeId: prospect.organizationTypeId,
    stateCode: prospect.stateCode,
    publicCompany: prospect.publicCompany,
    directoryMatch: prospect.directoryMatch,
  };
}
