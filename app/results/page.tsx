import { Suspense } from "react";
import { ResultsClient } from "./ResultsClient";

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted">
          Loading results…
        </div>
      }
    >
      <ResultsClient />
    </Suspense>
  );
}
