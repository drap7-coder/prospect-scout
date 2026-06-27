/** Opportunity-framed insights. Every bullet answers "so what?". */
export function WhyThisMatters({ insights }: { insights: string[] }) {
  if (insights.length === 0) return null;
  return (
    <section className="exec-section">
      <h4 className="exec-section-label">Why this matters</h4>
      <ul className="why-list">
        {insights.map((insight) => (
          <li key={insight}>
            <span aria-hidden className="why-check">
              ✓
            </span>
            <span>{insight}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
