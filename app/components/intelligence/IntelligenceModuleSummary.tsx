"use client";

import type { OrganizationIntelligenceModule } from "@/lib/intelligence/framework/types";

export function IntelligenceModuleSummary({
  module,
  compact = false,
  onSelect,
}: {
  module: OrganizationIntelligenceModule;
  compact?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  if (module.summaryMetrics.length === 0) return null;

  return (
    <section
      className={`intel-module ${compact ? "intel-module--compact" : ""}`}
      aria-label={module.title}
    >
      <button
        type="button"
        className="intel-module__header"
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.();
        }}
      >
        <span className="intel-module__icon" aria-hidden>
          {module.icon}
        </span>
        <span className="intel-module__title">{module.title}</span>
      </button>
      <ul className="intel-module__metrics">
        {module.summaryMetrics.map((metric) => (
          <li key={metric.id} className="intel-module__metric">
            <span className="intel-module__metric-value">{metric.value}</span>{" "}
            <span className="intel-module__metric-label">{metric.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
