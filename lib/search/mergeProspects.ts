import type { Prospect } from "@/lib/search/types";

function prospectRank(p: Prospect): number {
  return p.score * 1000 + p.signals.length * 10 + p.sourceTrail.length;
}

function normalizeOrgKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Stable warehouse rows merge by id; live-provider rows fall back to normalized name. */
function prospectMergeKey(p: Prospect): string {
  if (p.id) return `id:${p.id}`;
  return `name:${normalizeOrgKey(p.name)}`;
}

function mergeProspectPair(a: Prospect, b: Prospect): Prospect {
  const winner = prospectRank(a) >= prospectRank(b) ? a : b;
  const other = winner === a ? b : a;
  const signalIds = new Set(winner.signals.map((s) => s.id));
  const mergedSignals = [
    ...winner.signals,
    ...other.signals.filter((s) => !signalIds.has(s.id)),
  ];
  const trailKeys = new Set(
    winner.sourceTrail.map((t) => `${t.source}|${t.evidenceText}`),
  );
  const mergedTrail = [
    ...winner.sourceTrail,
    ...other.sourceTrail.filter(
      (t) => !trailKeys.has(`${t.source}|${t.evidenceText}`),
    ),
  ];
  return {
    ...winner,
    score: Math.max(a.score, b.score),
    signals: mergedSignals,
    sourceTrail: mergedTrail,
    directoryMatch: a.directoryMatch || b.directoryMatch,
    sectorId: a.sectorId ?? b.sectorId,
    industryId: a.industryId ?? b.industryId,
    organizationTypeId: a.organizationTypeId ?? b.organizationTypeId,
    stateCode: a.stateCode ?? b.stateCode,
    publicCompany: a.publicCompany ?? b.publicCompany,
    website: a.website ?? b.website,
    description: a.description ?? b.description,
    employeeEstimate: a.employeeEstimate ?? b.employeeEstimate,
    discoveryConfidence: Math.max(
      a.discoveryConfidence ?? 0,
      b.discoveryConfidence ?? 0,
    ),
    matchReasons:
      a.matchReasons.length >= b.matchReasons.length
        ? a.matchReasons
        : b.matchReasons,
    sourceRecords: mergeSourceRecords(a.sourceRecords, b.sourceRecords),
  };
}

function mergeSourceRecords(
  a: Prospect["sourceRecords"],
  b: Prospect["sourceRecords"],
): Prospect["sourceRecords"] {
  const byKey = new Map<string, Prospect["sourceRecords"][number]>();
  for (const rec of [...a, ...b]) {
    const cur = byKey.get(rec.connector);
    if (!cur || rec.confidence > cur.confidence) {
      byKey.set(rec.connector, rec);
    }
  }
  return [...byKey.values()];
}

/** Merges prospect lists — warehouse rows keyed by id; provider rows by name when id-less. */
export function mergeProspectLists(
  existing: Prospect[],
  incoming: Prospect[],
): Prospect[] {
  const byKey = new Map<string, Prospect>();

  function put(p: Prospect) {
    const key = prospectMergeKey(p);
    const cur = byKey.get(key);
    if (!cur) {
      byKey.set(key, p);
      return;
    }
    byKey.set(key, mergeProspectPair(cur, p));
  }

  for (const p of existing) put(p);
  for (const p of incoming) put(p);

  return [...byKey.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
