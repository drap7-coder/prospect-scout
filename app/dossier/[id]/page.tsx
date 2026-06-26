import { DossierClient } from "./DossierClient";

export default async function DossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DossierClient id={id} />;
}
