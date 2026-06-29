import type { Organization } from "@/lib/discovery/organization";
import { deriveDomain } from "@/lib/discovery/organization";
import type { SectorAttributes } from "@/lib/organization/model";
import {
  EMAIL_PATTERN_SECTOR_KEY,
  type OrganizationEmailPattern,
} from "./types";

export function readEmailPatternFromSectorAttributes(
  attrs: SectorAttributes | undefined | null,
): OrganizationEmailPattern | null {
  if (!attrs) return null;
  const raw = attrs[EMAIL_PATTERN_SECTOR_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as unknown as OrganizationEmailPattern;
}

export function writeEmailPatternToOrganization(
  org: Organization,
  emailPattern: OrganizationEmailPattern,
): Organization {
  return {
    ...org,
    sectorAttributes: {
      ...(org.sectorAttributes ?? {}),
      [EMAIL_PATTERN_SECTOR_KEY]: emailPattern as unknown as SectorAttributes[string],
    },
  };
}

export function resolveOrganizationDomain(org: Organization): string | null {
  return org.domain ?? deriveDomain(org.website);
}

export function organizationNeedsEmailRefresh(
  org: Organization,
  ttlMs: number,
  now = Date.now(),
): boolean {
  const existing = readEmailPatternFromSectorAttributes(org.sectorAttributes);
  if (!existing?.lastCheckedAt) return true;
  const checked = Date.parse(existing.lastCheckedAt);
  if (!Number.isFinite(checked)) return true;
  return now - checked >= ttlMs;
}
