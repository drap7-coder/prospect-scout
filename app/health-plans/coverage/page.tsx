import { redirect } from "next/navigation";

/** Legacy route — health plans coverage now lives under the organization warehouse. */
export default function LegacyHealthPlanCoveragePage() {
  redirect("/warehouse/coverage");
}
