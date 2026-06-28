import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { CmsImportPaths } from "./types";

const moduleDir = dirname(fileURLToPath(import.meta.url));

/** Default CMS fixture paths bundled for offline import and tests. */
export function defaultCmsImportPaths(): CmsImportPaths {
  const fixtureRoot = join(moduleDir, "../../../../fixtures/import/cms");
  return {
    cpscCsv: join(fixtureRoot, "cpsc-contracts.csv"),
    qhpCsv: join(fixtureRoot, "qhp-issuers.csv"),
    medicaidMcoCsv: join(fixtureRoot, "medicaid-mcos.csv"),
  };
}
