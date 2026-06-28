import { computeManufacturerConnectorDiagnostics } from "./diagnostics";
import type { ManufacturerConnectorDiagnostics } from "./diagnostics";

export type ManufacturerCoverageReport = ManufacturerConnectorDiagnostics;

export function computeManufacturerCoverageReport(): ManufacturerCoverageReport {
  return computeManufacturerConnectorDiagnostics();
}
