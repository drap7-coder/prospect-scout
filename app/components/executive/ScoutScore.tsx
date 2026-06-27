import { resultScoreBadge } from "@/lib/intelligence/colors";

/**
 * Scout Score — the primary visual element of an executive card.
 * Confidence is intentionally rendered separately and only when uncertain.
 */
export function ScoutScore({
  score,
  confidencePercent,
}: {
  score: number;
  confidencePercent: number | null;
}) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className={`scout-score ${resultScoreBadge(score)}`} title="Scout Score">
        <span className="scout-score-value">{score}</span>
        <span className="scout-score-caption">Scout</span>
      </div>
      {confidencePercent != null ? (
        <span className="scout-score-confidence" title="Discovery confidence">
          {confidencePercent}% confidence
        </span>
      ) : null}
    </div>
  );
}
