import { parseCsvText } from "../parseCsv";

interface IssuerAccumulator {
  issuerLegalName: string;
  parentOrganization: string;
  states: Set<string>;
  hiosIds: Set<string>;
  marketplace: "HealthCare.gov" | "State-Based";
  datasetRowIds: Set<string>;
}

/** Aggregate Exchange Plan Attributes PUF rows into issuer-level QHP import records. */
export function planAttributesPufToQhpRecords(text: string): Record<string, string>[] {
  const rows = parseCsvText(text);
  const issuers = new Map<string, IssuerAccumulator>();

  for (const row of rows) {
    const issuerId = (row.IssuerId ?? row.issuer_id ?? "").trim();
    const state = (row.StateCode ?? row.state ?? "").trim().toUpperCase();
    const legalName = (
      row.IssuerMarketPlaceMarketingName ??
      row.issuer_legal_name ??
      ""
    ).trim();
    if (!issuerId || !legalName || !state) continue;

    const dentalOnly = (row.DentalOnlyPlan ?? "").toLowerCase() === "yes";
    if (dentalOnly) continue;

    const hiosProduct = (row.HIOSProductId ?? row.hios_id ?? "").trim();
    const hiosId = hiosProduct.length >= 5 ? hiosProduct.slice(0, 5) : issuerId;

    const existing = issuers.get(issuerId);
    if (!existing) {
      issuers.set(issuerId, {
        issuerLegalName: legalName,
        parentOrganization: legalName,
        states: new Set([state]),
        hiosIds: new Set([hiosId]),
        marketplace: "HealthCare.gov",
        datasetRowIds: new Set([`${issuerId}-${state}`]),
      });
      continue;
    }

    existing.states.add(state);
    existing.hiosIds.add(hiosId);
    existing.datasetRowIds.add(`${issuerId}-${state}`);
    if (legalName.length > existing.issuerLegalName.length) {
      existing.issuerLegalName = legalName;
    }
  }

  const records: Record<string, string>[] = [];
  for (const [issuerId, issuer] of issuers.entries()) {
    for (const hiosId of issuer.hiosIds) {
      for (const state of issuer.states) {
        records.push({
          hios_issuer_id: issuerId,
          hios_id: hiosId,
          issuer_legal_name: issuer.issuerLegalName,
          state,
          marketplace: issuer.marketplace,
          naic_id: "",
          website: "",
          parent_organization: issuer.parentOrganization,
          service_area_id: "",
          service_area_name: "",
          market_coverage: "",
          cover_entire_state: "",
          source_puf: "plan_attributes",
          dataset_row_id: `${issuerId}-${state}-${hiosId}`,
        });
      }
    }
  }

  return records;
}

/** Count distinct issuers in a Plan Attributes PUF (for fetch stats). */
export function countDistinctQhpIssuers(text: string): number {
  const rows = parseCsvText(text);
  return new Set(rows.map((row) => row.IssuerId).filter(Boolean)).size;
}
