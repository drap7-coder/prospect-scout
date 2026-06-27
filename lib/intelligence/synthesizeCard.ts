import type { NonprofitEnrichment } from "@/lib/discovery/connectors/propublica/types";
import { canonicalOrgTypeLabel } from "@/lib/discovery/canonicalOrgType";
import type { Prospect, ProspectSignal } from "@/lib/search/types";
import { industryLabel, organizationTypeLabel, sectorLabel } from "@/lib/taxonomy";
import { buildSourceRecords } from "./sourceRecords";
import { formatUsdCompact, formatWebsiteDisplay } from "./format";
import {
  sourceContributionDescription,
  sourceDisplayLabel,
} from "./sourceContributions";

export interface CardIdentity {
  name: string;
  orgType: string | null;
  industry: string | null;
  headquarters: string | null;
  website: string | null;
  websiteHref: string | null;
  matchScore: number;
  confidencePercent: number | null;
}

export interface IntelligenceBullet {
  text: string;
  priority: number;
}

export interface OpportunitySignalItem {
  label: string;
  detail: string;
  source: string;
  urgency: number;
}

export interface DataSourceBadge {
  id: string;
  label: string;
  contribution: string;
  confidence: number;
  sourceUrl?: string;
}

export interface IntelligenceCardModel {
  identity: CardIdentity;
  intelligence: IntelligenceBullet[];
  opportunitySignals: OpportunitySignalItem[];
  dataSources: DataSourceBadge[];
  whyNow: string | null;
  form990Url: string | null;
}

const SIZE_PHRASE: Record<string, string> = {
  enterprise: "Enterprise-scale",
  large: "Large",
  mid: "Mid-market",
  small: "Small",
};

function resolveOrgType(prospect: Prospect): string | null {
  if (prospect.canonicalOrganizationTypeId) {
    return canonicalOrgTypeLabel(prospect.canonicalOrganizationTypeId);
  }
  if (prospect.organizationTypeId) {
    return organizationTypeLabel(prospect.organizationTypeId);
  }
  if (prospect.buyerType) return prospect.buyerType;
  return null;
}

function resolveIndustry(prospect: Prospect): string | null {
  if (prospect.industryId) return industryLabel(prospect.industryId);
  if (prospect.sectorId) return sectorLabel(prospect.sectorId);
  return null;
}

function isSubstantiveLocation(location: string): boolean {
  const t = location.trim().toLowerCase();
  return Boolean(t) && t !== "unknown" && t !== "nationwide";
}

function signalCategory(signal: ProspectSignal): string {
  const hay = `${signal.label} ${signal.evidenceText}`.toLowerCase();
  if (/hiring|career|job|workforce|recruit/.test(hay)) return "hiring";
  if (signal.source === "SEC" || /filing|10-k|8-k|edgar/.test(hay)) return "sec";
  if (signal.source === "FDA" || /fda|recall|approval|clearance/.test(hay)) return "fda";
  if (signal.source === "CMS" || /medicare|medicaid|enrollment|star rating|advantage/.test(hay)) {
    return "cms";
  }
  if (signal.source === "RSS" || /news|press|announcement/.test(hay)) return "news";
  if (/facility|plant|expansion|opening|headquarters/.test(hay)) return "facilities";
  if (/growth|expansion|market/.test(hay)) return "growth";
  if (signal.type === "regulatory") return "regulatory";
  return "other";
}

function isMeaningfulSignal(signal: ProspectSignal): boolean {
  if (signal.strength === "weak" && signal.urgency < 0.35) return false;
  const label = signal.label.trim().toLowerCase();
  if (label.length < 4) return false;
  if (/placeholder|mock|sample|pending/.test(label)) return false;
  return true;
}

function synthesizeIntelligenceBullets(
  prospect: Prospect,
  nonprofit: NonprofitEnrichment | null,
): IntelligenceBullet[] {
  const bullets: IntelligenceBullet[] = [];
  const seen = new Set<string>();

  function add(text: string, priority: number) {
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    bullets.push({ text, priority });
  }

  if (nonprofit) {
    const rev = formatUsdCompact(nonprofit.revenue);
    const assets = formatUsdCompact(nonprofit.assets);
    const subsection = nonprofit.subsection501c ?? "Nonprofit";

    if (rev) {
      add(`${subsection} with ${rev} in reported annual revenue.`, 92);
    } else if (assets) {
      add(`Large nonprofit with ${assets} in reported assets.`, 90);
    } else if (nonprofit.nteeCategory) {
      add(`${subsection} focused on ${nonprofit.nteeCategory.toLowerCase()}.`, 78);
    }

    if (nonprofit.latestForm990Year && nonprofit.form990PdfUrl) {
      add(`Filed Form 990 for ${nonprofit.latestForm990Year} — financials on record.`, 70);
    }
  }

  if (prospect.publicCompany === true) {
    const secSignals = prospect.signals.filter((s) => s.source === "SEC");
    if (secSignals.length >= 2) {
      add("Public company with multiple recent SEC filings.", 88);
    } else {
      add("Publicly traded company with SEC disclosure history.", 82);
    }
  } else if (prospect.publicCompany === false && prospect.sectorId !== "nonprofit") {
    add("Privately held organization.", 45);
  }

  const cmsSignals = prospect.signals.filter((s) => s.source === "CMS");
  for (const s of cmsSignals.slice(0, 1)) {
    const hay = `${s.label} ${s.evidenceText}`.toLowerCase();
    if (/medicare advantage|advantage plan|ma plan/.test(hay)) {
      add("Medicare Advantage organization with CMS participation signals.", 86);
    } else if (/medicaid|mco|managed care/.test(hay)) {
      add("Managed care organization with Medicaid/CMS footprint.", 84);
    } else if (/enrollment|star rating/.test(hay)) {
      add("CMS enrollment or quality rating activity on record.", 80);
    }
  }

  const fdaSignals = prospect.signals.filter((s) => s.source === "FDA");
  if (fdaSignals.length > 0) {
    const recall = fdaSignals.some((s) => /recall/i.test(s.evidenceText + s.label));
    if (recall) {
      add("Recent FDA recall or enforcement activity.", 85);
    } else {
      add("FDA-regulated operations with recent regulatory signals.", 78);
    }
  }

  const orgType = resolveOrgType(prospect);
  const industry = resolveIndustry(prospect);
  if (orgType && prospect.stateCode && isSubstantiveLocation(prospect.location)) {
    const size = prospect.size ? SIZE_PHRASE[prospect.size] : null;
    const prefix = size ? `${size} ` : "";
    const industryPhrase = industry ? `${industry.toLowerCase()} ` : "";
    add(
      `${prefix}${industryPhrase}${orgType.toLowerCase()} operating in ${prospect.stateCode}.`.replace(
        /\s+/g,
        " ",
      ),
      72,
    );
  } else if (orgType && industry) {
    add(`${orgType} in the ${industry.toLowerCase()} sector.`, 65);
  }

  if (prospect.employeeEstimate && prospect.employeeEstimate >= 500) {
    add(
      `Employs approximately ${prospect.employeeEstimate.toLocaleString()} people.`,
      68,
    );
  } else if (prospect.size === "enterprise" || prospect.size === "large") {
    add(`${SIZE_PHRASE[prospect.size]} organization by scale.`, 60);
  }

  const newsSignals = prospect.signals.filter(
    (s) => s.source === "RSS" || /news|press/.test(s.label.toLowerCase()),
  );
  if (newsSignals.length > 0) {
    add("Recent news or press coverage detected.", 62);
  }

  for (const reason of prospect.whyItMatters.slice(0, 2)) {
    if (reason.length > 20 && reason.length < 140) {
      add(reason.endsWith(".") ? reason : `${reason}.`, 55);
    }
  }

  for (const reason of prospect.matchReasons) {
    if (/verified|catalog|public company|nonprofit|employees|sector|industry|located/i.test(reason)) {
      add(reason.endsWith(".") ? reason : `${reason}.`, 50);
    }
  }

  if (bullets.length === 0 && prospect.description) {
    add(prospect.description, 40);
  }

  return bullets.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

function synthesizeOpportunitySignals(prospect: Prospect): OpportunitySignalItem[] {
  const items = prospect.signals
    .filter(isMeaningfulSignal)
    .map((signal) => {
      const category = signalCategory(signal);
      let label = signal.label;
      if (category === "hiring") label = label.replace(/^hiring:?\s*/i, "Hiring: ");
      if (category === "sec" && !/^sec/i.test(label)) label = `SEC: ${label}`;
      if (category === "fda" && !/^fda/i.test(label)) label = `FDA: ${label}`;
      if (category === "cms" && !/^cms/i.test(label)) label = `CMS: ${label}`;

      return {
        label,
        detail: signal.whyNow || signal.evidenceText,
        source: signal.source,
        urgency: signal.urgency + (signal.strength === "strong" ? 0.15 : 0),
      };
    })
    .sort((a, b) => b.urgency - a.urgency);

  const deduped: OpportunitySignalItem[] = [];
  const seenLabels = new Set<string>();
  for (const item of items) {
    const key = item.label.toLowerCase();
    if (seenLabels.has(key)) continue;
    seenLabels.add(key);
    deduped.push(item);
    if (deduped.length >= 3) break;
  }

  return deduped;
}

function buildDataSources(
  prospect: Prospect,
  nonprofit: NonprofitEnrichment | null,
): DataSourceBadge[] {
  const badges: DataSourceBadge[] = [];
  const seen = new Set<string>();

  for (const rec of buildSourceRecords(prospect)) {
    const id = rec.connector;
    if (seen.has(id)) continue;
    seen.add(id);
    badges.push({
      id,
      label: sourceDisplayLabel(id),
      contribution: sourceContributionDescription(id, rec.evidenceText),
      confidence: rec.confidence,
      sourceUrl: rec.sourceUrl,
    });
  }

  if (nonprofit && !seen.has("propublica")) {
    seen.add("propublica");
    badges.push({
      id: "propublica",
      label: "ProPublica",
      contribution: sourceContributionDescription(
        "propublica",
        nonprofit.latestForm990Year
          ? `Form 990 (${nonprofit.latestForm990Year}) financials and ${nonprofit.strein}.`
          : undefined,
      ),
      confidence: 0.88,
      sourceUrl: nonprofit.profileUrl,
    });
  }

  const order = [
    "directory",
    "nces",
    "sec",
    "cms",
    "fda",
    "irs-nonprofits",
    "propublica",
    "census",
    "rss",
    "public-web",
  ];

  return badges.sort(
    (a, b) =>
      (order.indexOf(a.id) === -1 ? 99 : order.indexOf(a.id)) -
      (order.indexOf(b.id) === -1 ? 99 : order.indexOf(b.id)),
  );
}

export function synthesizeIntelligenceCard(
  prospect: Prospect,
  nonprofitEnrichment: NonprofitEnrichment | null = null,
): IntelligenceCardModel {
  const website = prospect.website?.trim() || null;
  const websiteHref = website
    ? /^https?:\/\//i.test(website)
      ? website
      : `https://${website}`
    : null;

  const confidencePercent =
    prospect.discoveryConfidence != null
      ? Math.round(prospect.discoveryConfidence * 100)
      : null;

  const intelligence = synthesizeIntelligenceBullets(prospect, nonprofitEnrichment);
  const opportunitySignals = synthesizeOpportunitySignals(prospect);
  const dataSources = buildDataSources(prospect, nonprofitEnrichment);

  const whyNow =
    prospect.whyNow?.trim() && prospect.whyNow.length > 10 ? prospect.whyNow : null;

  return {
    identity: {
      name: prospect.name,
      orgType: resolveOrgType(prospect),
      industry: resolveIndustry(prospect),
      headquarters: isSubstantiveLocation(prospect.location) ? prospect.location : null,
      website: website ? formatWebsiteDisplay(website) : null,
      websiteHref,
      matchScore: prospect.score,
      confidencePercent,
    },
    intelligence,
    opportunitySignals,
    dataSources,
    whyNow,
    form990Url:
      nonprofitEnrichment?.form990PdfUrl ?? nonprofitEnrichment?.profileUrl ?? null,
  };
}
