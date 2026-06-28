import type { SearchIntent } from "@/lib/discovery/intent";
import type { Organization } from "@/lib/discovery/organization";
import type { ErisaCsvRow, ErisaQueryConstraints } from "./types";
import {
  normalizeSponsorNameKey,
  organizationFromErisaRow,
  withLatestErisaIntel,
} from "./organizationFromFiling";
import { parseErisaQueryConstraints } from "./queryIntent";
import { resetErisaHydrationCache } from "./hydrateIndex";

interface IndexedErisaOrg {
  organization: Organization;
  rows: ErisaCsvRow[];
  maxParticipants: number;
  latestYear: number;
  selfFunded: boolean;
}

let orgById = new Map<string, IndexedErisaOrg>();
let orgIdByEin = new Map<string, string>();
let orgIdByNameState = new Map<string, string>();

function aggregateRow(entry: IndexedErisaOrg, row: ErisaCsvRow): IndexedErisaOrg {
  const maxParticipants = Math.max(
    entry.maxParticipants,
    row.participantCount ?? 0,
  );
  const latestYear = Math.max(entry.latestYear, row.filingYear);
  const latestRow =
    row.filingYear >= latestYear ? row : entry.rows[entry.rows.length - 1]!;
  const organization = withLatestErisaIntel(entry.organization, latestRow);
  return {
    organization,
    rows: [...entry.rows, row],
    maxParticipants,
    latestYear,
    selfFunded: entry.selfFunded || row.selfFunded,
  };
}

function matchesConstraints(
  entry: IndexedErisaOrg,
  constraints: ErisaQueryConstraints,
): boolean {
  if (constraints.state) {
    if (!entry.organization.states.includes(constraints.state)) return false;
  }
  if (constraints.selfFundedOnly && !entry.selfFunded) return false;
  if (
    constraints.minParticipants != null &&
    entry.maxParticipants < constraints.minParticipants
  ) {
    return false;
  }
  return true;
}

/** Replace the in-memory ERISA index (used by connector + tests). */
export function setErisaIndex(entries: IndexedErisaOrg[]): void {
  orgById = new Map();
  orgIdByEin = new Map();
  orgIdByNameState = new Map();
  for (const entry of entries) {
    orgById.set(entry.organization.id, entry);
    const ein = entry.rows[0]?.sponsorEin;
    if (ein) orgIdByEin.set(ein, entry.organization.id);
    const nameKey = normalizeSponsorNameKey(
      entry.organization.canonicalName,
      entry.organization.states[0] ?? null,
    );
    orgIdByNameState.set(nameKey, entry.organization.id);
  }
}

export function clearErisaIndex(): void {
  setErisaIndex([]);
  resetErisaHydrationCache();
}

export function getErisaIndexSize(): number {
  return orgById.size;
}

/** Upsert organizations into the in-memory index from parsed CSV rows. */
export function indexErisaRows(rows: ErisaCsvRow[]): {
  organizations: Organization[];
  byEin: Map<string, string>;
  byNameState: Map<string, string>;
} {
  const byEin = new Map(orgIdByEin);
  const byNameState = new Map(orgIdByNameState);
  const working = new Map(orgById);

  for (const row of rows) {
    let orgId = byEin.get(row.sponsorEin);
    if (!orgId && row.sponsorState) {
      orgId = byNameState.get(
        normalizeSponsorNameKey(row.sponsorName, row.sponsorState),
      );
    }

    if (orgId && working.has(orgId)) {
      const updated = aggregateRow(working.get(orgId)!, row);
      working.set(orgId, updated);
      byEin.set(row.sponsorEin, orgId);
      byNameState.set(
        normalizeSponsorNameKey(updated.organization.canonicalName, row.sponsorState),
        orgId,
      );
      continue;
    }

    const org = organizationFromErisaRow(row);
    const entry: IndexedErisaOrg = {
      organization: org,
      rows: [row],
      maxParticipants: row.participantCount ?? 0,
      latestYear: row.filingYear,
      selfFunded: row.selfFunded,
    };
    working.set(org.id, entry);
    byEin.set(row.sponsorEin, org.id);
    byNameState.set(
      normalizeSponsorNameKey(row.sponsorName, row.sponsorState),
      org.id,
    );
  }

  orgById = working;
  orgIdByEin = byEin;
  orgIdByNameState = byNameState;

  return {
    organizations: [...working.values()].map((e) => e.organization),
    byEin,
    byNameState,
  };
}

/** Synchronous query against the in-memory ERISA index. */
export function searchErisaIndex(
  intent: SearchIntent,
  constraints: ErisaQueryConstraints = parseErisaQueryConstraints(intent),
): Organization[] {
  if (orgById.size === 0) return [];
  if (
    !constraints.employerFocused &&
    !constraints.selfFundedOnly &&
    !constraints.minParticipants
  ) {
    if (
      !/\b(5500|erisa|plan sponsor|benefits|welfare|self[- ]?fund)\b/i.test(
        intent.query,
      )
    ) {
      return [];
    }
  }

  const hits: Organization[] = [];
  for (const entry of orgById.values()) {
    if (!matchesConstraints(entry, constraints)) continue;
    hits.push(entry.organization);
  }
  return hits;
}

export function resolveErisaOrganizationId(
  ein: string,
  name: string,
  state: string | null,
): string | undefined {
  return (
    orgIdByEin.get(ein) ??
    (state
      ? orgIdByNameState.get(normalizeSponsorNameKey(name, state))
      : undefined)
  );
}

/** Resolve Form 5500 filing rows for a prospect / organization id. */
export function getErisaFilingsForProspect(
  prospectId: string,
  ein?: string,
  options?: { organizationName?: string; erisaIntelPresent?: boolean },
): import("./types").ErisaCsvRow[] {
  const direct = orgById.get(prospectId);
  if (direct) return direct.rows;

  const fromId = prospectId.match(/^erisa-(\d{9})$/);
  const resolvedEin = ein?.replace(/\D/g, "").slice(0, 9) ?? fromId?.[1];
  if (resolvedEin) {
    const orgId = orgIdByEin.get(resolvedEin);
    if (orgId) return orgById.get(orgId)?.rows ?? [];
  }

  if (options?.erisaIntelPresent && options.organizationName) {
    const nameKey = normalizeSponsorNameKey(options.organizationName, null);
    for (const entry of orgById.values()) {
      const entryKey = normalizeSponsorNameKey(entry.organization.canonicalName, null);
      if (entryKey === nameKey) return entry.rows;
    }
  }

  return [];
}

export function getErisaIndexedEntry(
  organizationId: string,
): IndexedErisaOrg | undefined {
  return orgById.get(organizationId);
}
