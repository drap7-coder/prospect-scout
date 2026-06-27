import type {
  NonprofitCandidate,
  NonprofitEnrichment,
  NonprofitOfficer,
  ProPublicaOrganizationResponse,
  ProPublicaSearchOrg,
} from "./types";

const NTEE_MAJOR: Record<string, string> = {
  A: "Arts, Culture & Humanities",
  B: "Education",
  C: "Environment and Animals",
  D: "Health",
  E: "Health",
  F: "Human Services",
  G: "International, Foreign Affairs",
  H: "Human Services",
  I: "Human Services",
  J: "Public, Societal Benefit",
  K: "Public, Societal Benefit",
  L: "Housing & Shelter",
  M: "Public, Societal Benefit",
  N: "Recreation & Sports",
  O: "Youth Development",
  P: "Human Services",
  Q: "International, Foreign Affairs",
  R: "Civil Rights & Advocacy",
  S: "Community Improvement",
  T: "Philanthropy & Voluntarism",
  U: "Science & Technology",
  V: "Social Science",
  W: "Public & Societal Benefit",
  X: "Religion Related",
  Y: "Mutual/Membership Benefit",
  Z: "Unknown, Unclassified",
};

/** Normalize EIN to digits-only string (preserves leading zeros in strein). */
export function normalizeEinDigits(ein: string | number | null | undefined): string {
  if (ein == null) return "";
  return String(ein).replace(/\D/g, "");
}

/** EIN integer for ProPublica API path (leading zeros stripped). */
export function einForApiPath(ein: string | number): string {
  const digits = normalizeEinDigits(ein);
  return String(parseInt(digits, 10));
}

export function formatStrein(ein: string | number): string {
  const digits = normalizeEinDigits(ein).padStart(9, "0");
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function subsectionLabel(code: number | null | undefined): string | null {
  if (code == null || !Number.isFinite(code)) return null;
  if (code === 92) return "4947(a)(1)";
  return `501(c)(${code})`;
}

export function nteeCategoryFromCode(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  const letter = code.trim().charAt(0).toUpperCase();
  return NTEE_MAJOR[letter] ?? code;
}

export function profileUrlForEin(ein: string | number): string {
  return `https://projects.propublica.org/nonprofits/organizations/${einForApiPath(ein)}`;
}

function latestFiling(response: ProPublicaOrganizationResponse) {
  const withData = response.filings_with_data ?? [];
  if (withData.length === 0) {
    const without = response.filings_without_data ?? [];
    return without[0] ?? null;
  }
  return [...withData].sort(
    (a, b) => (b.tax_prd_yr ?? 0) - (a.tax_prd_yr ?? 0),
  )[0]!;
}

export function normalizeSearchCandidate(
  org: ProPublicaSearchOrg,
  confidence: number,
): NonprofitCandidate {
  return {
    ein: normalizeEinDigits(org.ein),
    strein: org.strein ?? formatStrein(org.ein),
    name: org.name,
    city: org.city ?? null,
    state: org.state ?? null,
    nteeCode: org.ntee_code ?? org.raw_ntee_code ?? null,
    confidence,
  };
}

export function normalizeOrganizationEnrichment(
  response: ProPublicaOrganizationResponse,
): NonprofitEnrichment {
  const org = response.organization;
  const filing = latestFiling(response);
  const ein = normalizeEinDigits(org.ein);

  const revenue =
    filing?.totrevenue ??
    org.revenue_amount ??
    org.income_amount ??
    null;
  const expenses = filing?.totfuncexpns ?? null;
  const assets = filing?.totassetsend ?? org.asset_amount ?? null;

  const officers: NonprofitOfficer[] = [];
  const executiveCompensation = filing?.compnsatncurrofcr ?? null;

  return {
    ein,
    strein: org.strein ?? formatStrein(org.ein),
    legalName: org.name,
    city: org.city ?? null,
    state: org.state ?? null,
    subsection501c: subsectionLabel(org.subsection_code),
    nteeCategory: nteeCategoryFromCode(org.ntee_code),
    nteeCode: org.ntee_code ?? null,
    revenue: revenue ?? null,
    expenses: expenses ?? null,
    assets: assets ?? null,
    officers,
    executiveCompensation,
    latestForm990Year: filing?.tax_prd_yr ?? null,
    form990PdfUrl: filing?.pdf_url ?? null,
    form990XmlUrl: null,
    profileUrl: profileUrlForEin(org.ein),
  };
}
