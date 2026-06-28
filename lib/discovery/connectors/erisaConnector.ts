import { mergeOrganizations } from "../organization";
import type { DiscoveryConnector, ConnectorRecord } from "../connector";
import type { Organization } from "../organization";
import type { SearchIntent } from "../intent";
import { searchErisaIndex } from "@/lib/import/erisa/memoryIndex";
import { kickoffErisaIndexHydration } from "@/lib/import/erisa/hydrateIndex";
import { ERISA_CONNECTOR_ID } from "@/lib/import/erisa/types";

/** Persistent Form 5500 / ERISA plan sponsor source (Neon-backed index). */
export const erisaConnector: DiscoveryConnector = {
  id: ERISA_CONNECTOR_ID,
  label: "ERISA",

  discover(intent: SearchIntent): ConnectorRecord[] {
    kickoffErisaIndexHydration();
    const orgs = searchErisaIndex(intent);
    return orgs.map((org) => ({ __type: ERISA_CONNECTOR_ID, org }));
  },

  normalize(record: ConnectorRecord): Organization {
    return record.org as Organization;
  },

  merge: mergeOrganizations,
};
