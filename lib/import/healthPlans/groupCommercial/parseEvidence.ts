import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  GroupCommercialEvidenceRecord,
  GroupCommercialEvidenceSeedRow,
} from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = join(
  __dirname,
  "../../../../fixtures/import/healthPlans/group-commercial-evidence.json",
);

function normalizeSeedRow(row: GroupCommercialEvidenceSeedRow): GroupCommercialEvidenceRecord {
  return {
    organizationName: row.organizationName.trim(),
    parentOrganization: row.parentOrganization?.trim() || null,
    domain: row.domain?.trim() || null,
    aliases: row.aliases?.map((alias) => alias.trim()).filter(Boolean) ?? [],
    evidenceType: row.evidenceType,
    source: row.source ?? "curated",
    confidence: row.confidence ?? "high",
    reason: row.reason.trim(),
    allowParentBrandInheritance: row.allowParentBrandInheritance ?? false,
  };
}

export function parseGroupCommercialEvidenceFixture(
  fixturePath: string = DEFAULT_FIXTURE,
): GroupCommercialEvidenceRecord[] {
  const raw = JSON.parse(readFileSync(fixturePath, "utf8")) as GroupCommercialEvidenceSeedRow[];
  if (!Array.isArray(raw)) {
    throw new Error("group commercial evidence fixture must be a JSON array");
  }
  return raw.map(normalizeSeedRow);
}

export function defaultGroupCommercialEvidence(): GroupCommercialEvidenceRecord[] {
  return parseGroupCommercialEvidenceFixture();
}
