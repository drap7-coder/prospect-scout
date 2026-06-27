/** Human-readable description of what each data source contributed to a card. */
export function sourceContributionDescription(
  connectorOrLabel: string,
  evidenceText?: string,
): string {
  const key = connectorOrLabel.toLowerCase();

  const map: Record<string, string> = {
    directory: "Organization identity, industry classification, and headquarters from the indexed catalog.",
    catalog: "Organization identity, industry classification, and headquarters from the indexed catalog.",
    nces: "Education institution profile, location, and sector classification.",
    sec: "Public company status, SEC filings, and financial disclosure activity.",
    cms: "Medicare/Medicaid participation, enrollment signals, and healthcare payer data.",
    fda: "FDA registrations, recalls, approvals, and life-sciences regulatory activity.",
    "irs-nonprofits": "Nonprofit registration, EIN, and exempt organization classification.",
    irs: "Nonprofit registration, EIN, and exempt organization classification.",
    propublica: "Form 990 financials, assets, revenue, officers, and nonprofit filing history.",
    census: "Market sizing context — industry establishment counts for the geography.",
    rss: "Recent news coverage and press mentions.",
    "public-web": "Supplemental web presence and public company references.",
    web: "Supplemental web presence and public company references.",
    wikipedia: "Reference profile and organizational context.",
  };

  for (const [prefix, desc] of Object.entries(map)) {
    if (key.includes(prefix) || key === prefix) {
      return evidenceText ? `${desc} ${evidenceText}` : desc;
    }
  }

  if (/^sec$/i.test(connectorOrLabel)) {
    return map.sec!;
  }
  if (/^cms$/i.test(connectorOrLabel)) {
    return map.cms!;
  }
  if (/^fda$/i.test(connectorOrLabel)) {
    return map.fda!;
  }

  return evidenceText ?? "Contributed supporting evidence for this organization.";
}

export function sourceDisplayLabel(connector: string): string {
  const labels: Record<string, string> = {
    directory: "Catalog",
    nces: "NCES",
    sec: "SEC",
    cms: "CMS",
    fda: "FDA",
    "irs-nonprofits": "IRS",
    propublica: "ProPublica",
    "propublica-nonprofit-explorer": "ProPublica",
    census: "Census",
    "census-cbp": "Census",
    rss: "News",
    "public-web": "Web",
  };
  return labels[connector] ?? connector.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
