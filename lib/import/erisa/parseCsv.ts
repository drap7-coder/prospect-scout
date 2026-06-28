import type { ErisaCsvRow } from "./types";

const HEADER_ALIASES: Record<
  keyof Omit<ErisaCsvRow, "welfareBenefitTypes"> | "welfareBenefitTypes",
  string[]
> = {
  sponsorEin: ["sponsor_ein", "spons_dfe_ein", "ein", "spnsr_ein"],
  sponsorName: [
    "sponsor_name",
    "spons_dfe_name",
    "sponsor_dfe_name",
    "plan_sponsor_name",
  ],
  sponsorState: [
    "sponsor_state",
    "spons_dfe_mail_us_state",
    "sponsor_dfe_state",
    "state",
  ],
  sponsorCity: [
    "sponsor_city",
    "spons_dfe_mail_us_city",
    "sponsor_dfe_city",
    "city",
  ],
  planName: ["plan_name", "plan_name_line1", "plan_name_1"],
  planNumber: ["plan_number", "plan_num", "plan_num_1"],
  filingYear: [
    "filing_year",
    "form_tax_year",
    "tax_year",
    "sch_a_plan_year_begin_date",
  ],
  participantCount: [
    "participant_count",
    "tot_partcp_boy_cnt",
    "tot_active_participants",
    "total_participants",
  ],
  healthWelfarePlan: [
    "health_welfare_plan",
    "type_welfare_bnf_cd",
    "welfare_benefit_code",
  ],
  selfFunded: ["self_funded", "self_funded_ind", "funding_insurance"],
  fundingArrangement: [
    "funding_arrangement",
    "funding_arrangement_type",
    "type_funding_code",
  ],
  welfareBenefitTypes: ["welfare_benefit_types", "welfare_benefit_type"],
  ackId: ["ack_id", "filing_id", "acknowledgment_id"],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function mapHeaderIndex(
  headers: string[],
): Partial<Record<keyof ErisaCsvRow, number>> {
  const normalized = headers.map(normalizeHeader);
  const index: Partial<Record<keyof ErisaCsvRow, number>> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
    keyof ErisaCsvRow,
    string[],
  ][]) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx >= 0) index[field] = idx;
  }
  return index;
}

function cell(row: string[], idx: number | undefined): string {
  if (idx == null || idx < 0) return "";
  return row[idx]?.trim() ?? "";
}

function parseEin(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 9 ? digits : null;
}

function parseIntField(raw: string): number | null {
  const n = Number(raw.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseBool(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (!v) return false;
  if (["1", "true", "yes", "y"].includes(v)) return true;
  if (
    ["self-funded", "self funded", "self_insured", "self insured"].includes(v)
  ) {
    return true;
  }
  return false;
}

function inferSelfFunded(funding: string, explicit: boolean): boolean {
  if (explicit) return true;
  const v = funding.toLowerCase();
  return (
    v.includes("self") ||
    v.includes("self-funded") ||
    v.includes("self funded") ||
    v === "2"
  );
}

function inferHealthWelfare(raw: string, explicit: boolean): boolean {
  if (explicit) return true;
  const v = raw.toLowerCase();
  return v.length > 0 && v !== "0" && v !== "n" && v !== "no";
}

/** Parse Form 5500 CSV text into normalized sponsor filing rows. */
export function parseErisaCsv(text: string): ErisaCsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]!);
  const index = mapHeaderIndex(headers);
  if (index.sponsorEin == null || index.sponsorName == null) {
    throw new Error(
      "ERISA CSV must include sponsor EIN and sponsor name columns.",
    );
  }

  const rows: ErisaCsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const ein = parseEin(cell(cells, index.sponsorEin));
    const name = cell(cells, index.sponsorName);
    if (!ein || !name) continue;

    const funding = cell(cells, index.fundingArrangement);
    const welfareRaw = cell(cells, index.welfareBenefitTypes);
    const welfareTypes = welfareRaw
      ? welfareRaw
          .split(/[|;]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    rows.push({
      sponsorEin: ein,
      sponsorName: name,
      sponsorState:
        cell(cells, index.sponsorState).toUpperCase().slice(0, 2) || null,
      sponsorCity: cell(cells, index.sponsorCity) || null,
      planName: cell(cells, index.planName) || null,
      planNumber: cell(cells, index.planNumber) || "001",
      filingYear:
        parseIntField(cell(cells, index.filingYear)) ??
        new Date().getFullYear() - 1,
      participantCount: parseIntField(cell(cells, index.participantCount)),
      healthWelfarePlan: inferHealthWelfare(
        cell(cells, index.healthWelfarePlan),
        parseBool(cell(cells, index.healthWelfarePlan)),
      ),
      selfFunded: inferSelfFunded(
        funding,
        parseBool(cell(cells, index.selfFunded)),
      ),
      fundingArrangement: funding || null,
      welfareBenefitTypes: welfareTypes,
      ackId: cell(cells, index.ackId) || null,
    });
  }
  return rows;
}
