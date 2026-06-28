/** Parsed Form 5500 sponsor row from CSV import. */
export interface ErisaCsvRow {
  sponsorEin: string;
  sponsorName: string;
  sponsorState: string | null;
  sponsorCity: string | null;
  planName: string | null;
  planNumber: string | null;
  filingYear: number;
  participantCount: number | null;
  healthWelfarePlan: boolean;
  selfFunded: boolean;
  fundingArrangement: string | null;
  welfareBenefitTypes: string[];
  ackId: string | null;
}

/** Card / prospect intelligence derived from latest ERISA filing. */
export interface ErisaCardIntel {
  participantCount?: number;
  sponsorState?: string;
  planName?: string;
  healthWelfarePlan?: boolean;
  fundingArrangement?: string | null;
  latestFilingYear?: number;
  selfFunded?: boolean;
  tags?: string[];
  sourceLabel: "ERISA Form 5500";
}

export interface ErisaImportStats {
  rowsParsed: number;
  organizationsUpserted: number;
  filingsUpserted: number;
  serviceProvidersUpserted: number;
  skipped: number;
}

/** Query constraints inferred from natural-language search text. */
export interface ErisaQueryConstraints {
  state: string | null;
  selfFundedOnly: boolean;
  minParticipants: number | null;
  employerFocused: boolean;
}

export const ERISA_CONNECTOR_ID = "erisa";
export const ERISA_SOURCE_NAME = "ERISA";
