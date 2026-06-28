import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { CMS_DATA_SOURCES } from "./registry";
import { cmsMonthlyReportToCpscRecords } from "./transformCpsc";
import { planAttributesPufToQhpRecords } from "./transformQhp";
import { serviceAreaPufToQhpRecords, countDistinctServiceAreaIssuers } from "./transformServiceAreaQhp";
import {
  mergeQhpSourceRecords,
  countNetNewServiceAreaIssuers,
} from "./mergeQhpSources";
import { medicaidProgramsToMcoRecords } from "./transformMedicaid";
import { medicaidEnrollmentToRecords } from "./transformMedicaidEnrollment";
import { writeCsvFile } from "../parseCsv";

const moduleDir = dirname(fileURLToPath(import.meta.url));

export interface CmsProductionPaths {
  root: string;
  cpscCsv: string;
  qhpCsv: string;
  medicaidMcoCsv: string;
  medicaidEnrollmentCsv: string;
  manifestJson: string;
  importBaselineJson: string;
}

export function productionCmsDataRoot(): string {
  return join(moduleDir, "../../../../../data/import/cms/production");
}

export function productionCmsPaths(): CmsProductionPaths {
  const root = productionCmsDataRoot();
  return {
    root,
    cpscCsv: join(root, "cpsc-contracts.csv"),
    qhpCsv: join(root, "qhp-issuers.csv"),
    medicaidMcoCsv: join(root, "medicaid-mcos.csv"),
    medicaidEnrollmentCsv: join(root, "medicaid-enrollment.csv"),
    manifestJson: join(root, "manifest.json"),
    importBaselineJson: join(root, "import-baseline.json"),
  };
}

export interface CmsFetchStats {
  fetchedAt: string;
  cpscRawRows: number;
  qhpPlanAttributesRows: number;
  qhpServiceAreaRows: number;
  qhpMergedRows: number;
  qhpDistinctIssuers: number;
  qhpNetNewFromServiceArea: number;
  medicaidProgramRows: number;
  medicaidEnrollmentRows: number;
  sources: typeof CMS_DATA_SOURCES;
}

const CPSC_HEADERS = [
  "contract_id",
  "legal_entity_name",
  "marketing_name",
  "parent_organization",
  "contract_type",
  "state_service",
  "star_rating",
  "naic_id",
  "dataset_row_id",
];

const QHP_HEADERS = [
  "hios_issuer_id",
  "hios_id",
  "issuer_legal_name",
  "state",
  "marketplace",
  "naic_id",
  "website",
  "parent_organization",
  "service_area_id",
  "service_area_name",
  "market_coverage",
  "cover_entire_state",
  "source_puf",
  "dataset_row_id",
];

const MEDICAID_HEADERS = [
  "mco_id",
  "organization_name",
  "parent_organization",
  "state",
  "plan_type",
  "naic_id",
  "dataset_row_id",
];

const MEDICAID_ENROLLMENT_HEADERS = [
  "plan_id",
  "organization_name",
  "parent_organization",
  "state",
  "program_name",
  "plan_type",
  "enrollment",
  "reporting_period",
  "naic_id",
  "dataset_row_id",
];

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "ProspectScout/1.0 (health plan catalog ingestion; contact@prospectscout.local)",
      Accept: "*/*",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function extractFirstCsvFromZip(buffer: Buffer): string {
  const dir = join(tmpdir(), `cms-cpsc-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const zipPath = join(dir, "cpsc.zip");
  try {
    writeFileSync(zipPath, buffer);
    execFileSync("unzip", ["-o", zipPath, "-d", dir], { stdio: "pipe" });
    const csvPath = findCsvFile(dir);
    if (!csvPath) throw new Error("No CSV found in CMS CPSC zip");
    return readFileSync(csvPath, "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function findCsvFile(root: string): string | null {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = findCsvFile(full);
      if (nested) return nested;
      continue;
    }
    if (entry.name.endsWith(".csv")) return full;
  }
  return null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "ProspectScout/1.0 (health plan catalog ingestion; contact@prospectscout.local)",
      Accept: "text/csv,application/json,*/*",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function fetchMedicaidDatastoreJson(
  url: string,
  options: { conditions?: { property: string; value: string; operator: string }[] } = {},
): Promise<Record<string, string>[]> {
  const records: Record<string, string>[] = [];
  let offset = 0;
  const limit = 500;
  for (;;) {
    const body: Record<string, unknown> = { limit, offset, count: true, results: true };
    if (options.conditions?.length) {
      body.conditions = options.conditions;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "ProspectScout/1.0 (health plan catalog ingestion; contact@prospectscout.local)",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching Medicaid datastore ${url}`);
    const data = (await res.json()) as {
      results?: Record<string, string>[];
      count?: number;
    };
    const batch = data.results ?? [];
    records.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
    if (data.count != null && offset >= data.count) break;
  }
  return records;
}

/** Download national CMS datasets and write normalized CSVs for the import pipeline. */
export async function fetchNationalCmsHealthPlanData(
  paths: CmsProductionPaths = productionCmsPaths(),
): Promise<CmsFetchStats> {
  mkdirSync(paths.root, { recursive: true });

  const cpscZip = await fetchBuffer(CMS_DATA_SOURCES.cpsc.url);
  const cpscRawText = extractFirstCsvFromZip(cpscZip);
  const cpscRecords = cmsMonthlyReportToCpscRecords(cpscRawText);
  writeCsvFile(paths.cpscCsv, CPSC_HEADERS, cpscRecords);

  const qhpPlanAttributesText = await fetchText(CMS_DATA_SOURCES.qhpPlanAttributes.url);
  const qhpPlanAttributesRecords = planAttributesPufToQhpRecords(qhpPlanAttributesText);

  const qhpServiceAreaText = await fetchText(CMS_DATA_SOURCES.qhpServiceArea.url);
  const qhpServiceAreaRecords = serviceAreaPufToQhpRecords(qhpServiceAreaText);
  const qhpMergedRecords = mergeQhpSourceRecords(
    qhpPlanAttributesRecords,
    qhpServiceAreaRecords,
  );
  writeCsvFile(
    paths.qhpCsv,
    QHP_HEADERS,
    qhpMergedRecords.map((row) => ({ ...row })),
  );

  const medicaidRows = await fetchMedicaidDatastoreJson(CMS_DATA_SOURCES.medicaidMco.url);
  const medicaidRecords = medicaidProgramsToMcoRecords(medicaidRows);
  writeCsvFile(paths.medicaidMcoCsv, MEDICAID_HEADERS, medicaidRecords);

  const medicaidEnrollmentRows = await fetchMedicaidDatastoreJson(
    CMS_DATA_SOURCES.medicaidEnrollment.url,
    { conditions: [{ property: "year", value: "2024", operator: "=" }] },
  );
  const medicaidEnrollmentRecords = medicaidEnrollmentToRecords(medicaidEnrollmentRows, {
    preferredYear: "2024",
  });
  writeCsvFile(
    paths.medicaidEnrollmentCsv,
    MEDICAID_ENROLLMENT_HEADERS,
    medicaidEnrollmentRecords,
  );

  const qhpDistinctIssuers = new Set(
    qhpMergedRecords.map((row) => (row.hios_issuer_id ?? "").trim()).filter(Boolean),
  ).size;

  const stats: CmsFetchStats = {
    fetchedAt: new Date().toISOString(),
    cpscRawRows: cpscRecords.length,
    qhpPlanAttributesRows: qhpPlanAttributesRecords.length,
    qhpServiceAreaRows: qhpServiceAreaRecords.length,
    qhpMergedRows: qhpMergedRecords.length,
    qhpDistinctIssuers,
    qhpNetNewFromServiceArea: countNetNewServiceAreaIssuers(
      qhpPlanAttributesRecords,
      qhpServiceAreaRecords,
    ),
    medicaidProgramRows: medicaidRecords.length,
    medicaidEnrollmentRows: medicaidEnrollmentRecords.length,
    sources: CMS_DATA_SOURCES,
  };

  writeFileSync(
    paths.manifestJson,
    JSON.stringify({ ...stats, paths }, null, 2),
    "utf8",
  );

  return stats;
}

/** True when production CMS CSV snapshots exist on disk. */
export function productionCmsDataAvailable(
  paths: CmsProductionPaths = productionCmsPaths(),
): boolean {
  return (
    existsSync(paths.cpscCsv) &&
    existsSync(paths.qhpCsv) &&
    existsSync(paths.medicaidMcoCsv)
  );
}

export function readProductionFetchManifest(
  paths: CmsProductionPaths = productionCmsPaths(),
): CmsFetchStats | null {
  if (!existsSync(paths.manifestJson)) return null;
  try {
    return JSON.parse(readFileSync(paths.manifestJson, "utf8")) as CmsFetchStats;
  } catch {
    return null;
  }
}
