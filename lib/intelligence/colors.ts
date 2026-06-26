import type { SignalSource } from "@/lib/search/types";

export interface ScoreTone {
  text: string;
  bg: string;
  border: string;
  bar: string;
  label: string;
}

export interface SourceTone {
  text: string;
  bg: string;
  border: string;
  borderLeft: string;
  dot: string;
  ring: string;
}

export function scoreTone(score: number): ScoreTone {
  if (score >= 80) {
    return {
      text: "text-good",
      bg: "bg-good/12",
      border: "border-good/35",
      bar: "bg-good",
      label: "High",
    };
  }
  if (score >= 60) {
    return {
      text: "text-warn",
      bg: "bg-warn/12",
      border: "border-warn/35",
      bar: "bg-warn",
      label: "Moderate",
    };
  }
  return {
    text: "text-muted",
    bg: "bg-surface-2",
    border: "border-border",
    bar: "bg-muted-2",
    label: "Watch",
  };
}

const SOURCE_TONES: Record<string, SourceTone> = {
  CMS: {
    text: "text-source-cms",
    bg: "bg-source-cms/12",
    border: "border-source-cms/30",
    borderLeft: "border-l-source-cms",
    dot: "bg-source-cms",
    ring: "ring-source-cms/25",
  },
  SEC: {
    text: "text-source-sec",
    bg: "bg-source-sec/12",
    border: "border-source-sec/30",
    borderLeft: "border-l-source-sec",
    dot: "bg-source-sec",
    ring: "ring-source-sec/25",
  },
  FDA: {
    text: "text-source-fda",
    bg: "bg-source-fda/12",
    border: "border-source-fda/30",
    borderLeft: "border-l-source-fda",
    dot: "bg-source-fda",
    ring: "ring-source-fda/25",
  },
  RSS: {
    text: "text-source-rss",
    bg: "bg-source-rss/12",
    border: "border-source-rss/30",
    borderLeft: "border-l-source-rss",
    dot: "bg-source-rss",
    ring: "ring-source-rss/25",
  },
  "Public Web": {
    text: "text-source-web",
    bg: "bg-source-web/12",
    border: "border-source-web/30",
    borderLeft: "border-l-source-web",
    dot: "bg-source-web",
    ring: "ring-source-web/25",
  },
};

export function sourceTone(source: SignalSource | string): SourceTone {
  return (
    SOURCE_TONES[source] ?? {
      text: "text-accent-cyan",
      bg: "bg-accent-soft",
      border: "border-accent/25",
      borderLeft: "border-l-accent-cyan",
      dot: "bg-accent-cyan",
      ring: "ring-accent/20",
    }
  );
}

export function confidenceTone(
  confidence: "high" | "medium" | "low",
): { text: string; dot: string } {
  if (confidence === "high") {
    return { text: "text-good", dot: "bg-good" };
  }
  if (confidence === "medium") {
    return { text: "text-warn", dot: "bg-warn" };
  }
  return { text: "text-muted-2", dot: "bg-muted-2" };
}

export function freshnessTone(days: number): string {
  if (days <= 7) return "text-good";
  if (days <= 30) return "text-warn";
  return "text-muted";
}
