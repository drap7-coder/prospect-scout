import { HEALTH_PLANS_DIRECTORY } from "@/lib/directories/healthPlans";
import type { OrganizationRecord } from "@/lib/directories/types";

/**
 * Curated directory of regional, community, and private health-plan organizations
 * that may not appear in SEC EDGAR or the CMS MA contract registry.
 *
 * Master directory records are the source of truth; supplemental entries cover
 * additional regional plans used by the Public Web provider.
 */

export type HealthPlanBuyerType =
  | "regional-plan"
  | "community-plan"
  | "tpa"
  | "aso"
  | "medicaid-mco"
  | "exchange-carrier";

export type KnownProgram =
  | "commercial"
  | "Medicaid"
  | "Medicare"
  | "Medicare Advantage"
  | "exchange"
  | "TPA"
  | "ASO";

export interface HealthPlanDirectoryEntry {
  id: string;
  name: string;
  website: string;
  state: string;
  region: string;
  buyerType: HealthPlanBuyerType;
  notes?: string;
  knownPrograms: KnownProgram[];
  aliases: string[];
}

function toHealthPlanDirectoryEntry(record: OrganizationRecord): HealthPlanDirectoryEntry {
  const programs: KnownProgram[] = [];
  if (record.commercial) programs.push("commercial");
  if (record.medicaid) programs.push("Medicaid");
  if (record.medicare) programs.push("Medicare", "Medicare Advantage");
  if (record.exchange) programs.push("exchange");
  if (record.tpa) programs.push("TPA");
  if (record.aso) programs.push("ASO");

  let buyerType: HealthPlanBuyerType = "community-plan";
  if (record.tpa) buyerType = "tpa";
  else if (record.aso) buyerType = "aso";
  else if (record.medicaid && !record.commercial) buyerType = "medicaid-mco";
  else if (record.exchange) buyerType = "exchange-carrier";
  else if (record.tags?.includes("regional")) buyerType = "regional-plan";

  return {
    id: record.id,
    name: record.name,
    website: record.website ?? "",
    state: record.statesServed[0] ?? "US",
    region: record.regions[0] ?? "national",
    buyerType,
    knownPrograms: programs,
    aliases: record.aliases,
  };
}

/** Regional plans not yet mirrored in the master health-plans directory. */
const SUPPLEMENTAL_HEALTH_PLANS: HealthPlanDirectoryEntry[] = [
  {
    id: "dir-hp-fallon",
    name: "Fallon Health",
    website: "https://www.fallonhealth.org",
    state: "MA",
    region: "northeast",
    buyerType: "community-plan",
    notes: "Community-focused Massachusetts plan with Medicaid and senior programs.",
    knownPrograms: ["commercial", "Medicaid", "Medicare Advantage"],
    aliases: ["fallon health", "fallon community health plan", "fallon"],
  },
  {
    id: "dir-hp-mvp",
    name: "MVP Health Care",
    website: "https://www.mvphealthcare.com",
    state: "NY",
    region: "northeast",
    buyerType: "regional-plan",
    notes: "Upstate New York regional carrier with commercial and government lines.",
    knownPrograms: ["commercial", "Medicare Advantage", "Medicaid", "exchange"],
    aliases: ["mvp health care", "mvp healthcare", "mvp"],
  },
  {
    id: "dir-hp-moda",
    name: "Moda Health",
    website: "https://www.modahealth.com",
    state: "OR",
    region: "west",
    buyerType: "regional-plan",
    notes: "Oregon and Alaska regional plan with strong commercial book.",
    knownPrograms: ["commercial", "Medicare Advantage", "exchange"],
    aliases: ["moda health", "moda"],
  },
  {
    id: "dir-hp-priority",
    name: "Priority Health",
    website: "https://www.priorityhealth.com",
    state: "MI",
    region: "midwest",
    buyerType: "regional-plan",
    notes: "Michigan Blues-affiliated regional plan.",
    knownPrograms: ["commercial", "Medicare Advantage", "Medicaid", "exchange"],
    aliases: ["priority health", "priorityhealth"],
  },
  {
    id: "dir-hp-selecthealth",
    name: "SelectHealth",
    website: "https://selecthealth.org",
    state: "UT",
    region: "west",
    buyerType: "regional-plan",
    notes: "Intermountain-affiliated plan serving Utah and Idaho.",
    knownPrograms: ["commercial", "Medicaid", "Medicare Advantage", "exchange"],
    aliases: ["selecthealth", "select health"],
  },
  {
    id: "dir-hp-healthpartners-mn",
    name: "HealthPartners",
    website: "https://www.healthpartners.com",
    state: "MN",
    region: "midwest",
    buyerType: "regional-plan",
    notes: "Minnesota provider-sponsored plan and care system.",
    knownPrograms: ["commercial", "Medicaid", "Medicare Advantage", "exchange"],
    aliases: ["healthpartners", "health partners minnesota"],
  },
  {
    id: "dir-hp-quartz",
    name: "Quartz Health Solutions",
    website: "https://quartzbenefits.com",
    state: "WI",
    region: "midwest",
    buyerType: "community-plan",
    notes: "Wisconsin community health plan (formerly Dean Health Plan).",
    knownPrograms: ["commercial", "Medicaid", "Medicare Advantage"],
    aliases: ["quartz health", "quartz benefits", "dean health plan", "quartz"],
  },
  {
    id: "dir-hp-allied-benefit",
    name: "Allied Benefit Systems",
    website: "https://www.alliedbenefit.com",
    state: "IL",
    region: "midwest",
    buyerType: "tpa",
    notes: "Third-party administrator for self-funded employer plans.",
    knownPrograms: ["TPA", "ASO", "commercial"],
    aliases: ["allied benefit", "allied benefit systems", "allied tpa"],
  },
  {
    id: "dir-hp-bluecare-tn",
    name: "BlueCare Tennessee",
    website: "https://www.bcbst.com",
    state: "TN",
    region: "southeast",
    buyerType: "medicaid-mco",
    notes: "Tennessee Blues Medicaid managed care and commercial lines.",
    knownPrograms: ["Medicaid", "commercial", "Medicare Advantage", "exchange"],
    aliases: ["bluecare tennessee", "bcbst", "bluecross blueshield tennessee"],
  },
];

const masterNames = new Set(
  HEALTH_PLANS_DIRECTORY.map((r) => r.name.toLowerCase()),
);

export const HEALTH_PLAN_DIRECTORY: HealthPlanDirectoryEntry[] = [
  ...HEALTH_PLANS_DIRECTORY.map(toHealthPlanDirectoryEntry),
  ...SUPPLEMENTAL_HEALTH_PLANS.filter(
    (entry) => !masterNames.has(entry.name.toLowerCase()),
  ),
];
