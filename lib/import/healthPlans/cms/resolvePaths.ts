import { defaultCmsImportPaths } from "./fixtures";
import {
  productionCmsDataAvailable,
  productionCmsPaths,
} from "./sources/fetch";
import type { CmsImportPaths } from "./types";

/**
 * Resolve CMS CSV paths for import.
 * Prefers production snapshots when available unless USE_CMS_FIXTURES=1.
 */
export function resolveCmsImportPaths(): CmsImportPaths {
  if (process.env.USE_CMS_FIXTURES === "1") {
    return defaultCmsImportPaths();
  }
  const production = productionCmsPaths();
  if (productionCmsDataAvailable(production)) {
    return {
      cpscCsv: production.cpscCsv,
      qhpCsv: production.qhpCsv,
      medicaidMcoCsv: production.medicaidMcoCsv,
      medicaidEnrollmentCsv: production.medicaidEnrollmentCsv,
    };
  }
  return defaultCmsImportPaths();
}

export function cmsImportMode(): "production" | "fixture" {
  const paths = resolveCmsImportPaths();
  const production = productionCmsPaths();
  if (
    paths.cpscCsv === production.cpscCsv &&
    productionCmsDataAvailable(production)
  ) {
    return "production";
  }
  return "fixture";
}
