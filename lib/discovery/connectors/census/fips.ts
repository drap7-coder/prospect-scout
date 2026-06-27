/** US postal abbreviation → Census state FIPS (2-digit, zero-padded). */
export const STATE_POSTAL_TO_FIPS: Record<string, string> = {
  AL: "01",
  AK: "02",
  AZ: "04",
  AR: "05",
  CA: "06",
  CO: "08",
  CT: "09",
  DE: "10",
  DC: "11",
  FL: "12",
  GA: "13",
  HI: "15",
  ID: "16",
  IL: "17",
  IN: "18",
  IA: "19",
  KS: "20",
  KY: "21",
  LA: "22",
  ME: "23",
  MD: "24",
  MA: "25",
  MI: "26",
  MN: "27",
  MS: "28",
  MO: "29",
  MT: "30",
  NE: "31",
  NV: "32",
  NH: "33",
  NJ: "34",
  NM: "35",
  NY: "36",
  NC: "37",
  ND: "38",
  OH: "39",
  OK: "40",
  OR: "41",
  PA: "42",
  RI: "44",
  SC: "45",
  SD: "46",
  TN: "47",
  TX: "48",
  UT: "49",
  VT: "50",
  VA: "51",
  WA: "53",
  WV: "54",
  WI: "55",
  WY: "56",
  PR: "72",
};

export const STATE_FIPS_TO_POSTAL: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_POSTAL_TO_FIPS).map(([postal, fips]) => [fips, postal]),
);

export function postalToStateFips(state: string | null | undefined): string | null {
  if (!state?.trim()) return null;
  const key = state.trim().toUpperCase();
  return STATE_POSTAL_TO_FIPS[key] ?? null;
}

export function normalizeCountyFips(county: string | null | undefined): string | null {
  if (!county?.trim()) return null;
  const digits = county.replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(-3).padStart(3, "0");
}

export function normalizeZip(zip: string | null | undefined): string | null {
  if (!zip?.trim()) return null;
  const digits = zip.replace(/\D/g, "").slice(0, 5);
  return digits.length === 5 ? digits : null;
}
