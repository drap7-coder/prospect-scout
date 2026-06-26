import type {
  Prospect,
  ProspectSignal,
  SignalSource,
  SignalStrength,
  SignalType,
} from "@/lib/search/types";

export type EvidenceConfidence = "high" | "medium" | "low";

export interface EvidenceItem {
  id: string;
  source: SignalSource;
  snippet: string;
  freshnessDays: number;
  confidence: EvidenceConfidence;
  signalLabel?: string;
  signalType?: SignalType;
}

const SOURCE_ORDER: SignalSource[] = [
  "Directory",
  "CMS",
  "SEC",
  "FDA",
  "RSS",
  "Public Web",
  "Company",
  "Careers",
];

/** Normalizes provider labels for display grouping. */
export function displaySource(source: SignalSource): SignalSource {
  if (source === "Company" || source === "Careers") return "Public Web";
  return source;
}

export function strengthToConfidence(
  strength: SignalStrength,
): EvidenceConfidence {
  if (strength === "strong") return "high";
  if (strength === "moderate") return "medium";
  return "low";
}

/** Analyst-style briefing — never more than ~2 sentences. */
export function analystSnippet(text: string, fallback?: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    return fallback ?? "Signal detected from public source record.";
  }

  const parts = clean.match(/[^.!?]+[.!?]+/g);
  let out = parts ? parts.slice(0, 2).join(" ").trim() : clean;
  if (out.length > 200) {
    out = `${out.slice(0, 197).trim()}…`;
  }
  return out;
}

function evidenceFromSignal(signal: ProspectSignal): EvidenceItem {
  return {
    id: `sig-${signal.id}-${signal.freshnessDays}`,
    source: displaySource(signal.source),
    snippet: analystSnippet(signal.evidenceText, signal.whyNow),
    freshnessDays: signal.freshnessDays,
    confidence: strengthToConfidence(signal.strength),
    signalLabel: signal.label,
    signalType: signal.type,
  };
}

function evidenceFromTrail(
  source: SignalSource,
  text: string,
  freshnessDays: number,
  index: number,
): EvidenceItem | null {
  if (/unavailable|placeholder/i.test(text)) return null;
  return {
    id: `trail-${source}-${index}`,
    source: displaySource(source),
    snippet: analystSnippet(text),
    freshnessDays,
    confidence: "medium",
  };
}

/** Builds deduplicated evidence items from signals and source trail. */
export function buildEvidenceItems(prospect: Prospect): EvidenceItem[] {
  const baseFreshness = prospectFreshness(prospect);
  const items: EvidenceItem[] = [];

  for (const signal of prospect.signals) {
    items.push(evidenceFromSignal(signal));
  }

  prospect.sourceTrail.forEach((trail, i) => {
    const item = evidenceFromTrail(
      trail.source,
      trail.evidenceText,
      baseFreshness,
      i,
    );
    if (item) items.push(item);
  });

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.source}:${item.snippet.slice(0, 48)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function prospectFreshness(prospect: Prospect): number {
  if (prospect.signals.length === 0) return 999;
  return Math.min(...prospect.signals.map((s) => s.freshnessDays));
}

export function evidenceSourceCount(prospect: Prospect): number {
  return activeSources(prospect).length;
}

/** Distinct evidence sources for a prospect, in display order. */
export function activeSources(prospect: Prospect): SignalSource[] {
  const sources = new Set<SignalSource>();
  for (const s of prospect.signals) sources.add(displaySource(s.source));
  for (const t of prospect.sourceTrail) {
    if (!/unavailable/i.test(t.evidenceText)) {
      sources.add(displaySource(t.source));
    }
  }
  return SOURCE_ORDER.filter((s) => sources.has(s));
}

export function topSignals(prospect: Prospect, limit = 3): ProspectSignal[] {
  return [...prospect.signals]
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, limit);
}

export function formatFreshness(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.max(1, Math.round(days / 7))} wk ago`;
  if (days < 365) return `${Math.max(1, Math.round(days / 30))} mo ago`;
  return `${Math.round(days / 365)} yr ago`;
}

export function groupEvidenceBySource(
  items: EvidenceItem[],
): Map<SignalSource, EvidenceItem[]> {
  const groups = new Map<SignalSource, EvidenceItem[]>();
  for (const source of SOURCE_ORDER) {
    const matches = items
      .filter((e) => e.source === source)
      .sort((a, b) => a.freshnessDays - b.freshnessDays);
    if (matches.length > 0) groups.set(source, matches);
  }
  return groups;
}

export function leadershipSignals(prospect: Prospect): ProspectSignal[] {
  return prospect.signals.filter(
    (s) =>
      s.type === "leadership" ||
      /leadership|executive|ceo|cfo|chief|president/i.test(
        `${s.label} ${s.evidenceText}`,
      ),
  );
}
