/** One-sentence executive thesis — the first thing an executive reads. */
export function ExecutiveThesis({ thesis }: { thesis: string | null }) {
  if (!thesis) return null;
  return <p className="exec-thesis">{thesis}</p>;
}
