import type { Prospect } from "@/lib/search/types";
import type { DiscoveryRow } from "./discoveryRows";

/** First sort bucket for a prospect display name (A–Z, or "#" for non-letters). */
export function alphabetBucket(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "#";
  const first = trimmed.charAt(0).toUpperCase();
  if (/[A-Z]/.test(first)) return first;
  return "#";
}

const LETTER_ORDER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function sortLetterKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    const ai = LETTER_ORDER.indexOf(a);
    const bi = LETTER_ORDER.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    return a.localeCompare(b);
  });
}

/**
 * Group prospects into one horizontal scroll row per letter.
 * Preserves incoming order within each letter bucket.
 */
export function buildAlphabetRows(prospects: Prospect[]): DiscoveryRow[] {
  const byLetter = new Map<string, Prospect[]>();

  for (const prospect of prospects) {
    const letter = alphabetBucket(prospect.name);
    const bucket = byLetter.get(letter);
    if (bucket) bucket.push(prospect);
    else byLetter.set(letter, [prospect]);
  }

  return sortLetterKeys([...byLetter.keys()]).map((letter) => {
    const members = byLetter.get(letter) ?? [];
    const countLabel =
      members.length === 1 ? "1 organization" : `${members.length} organizations`;
    return {
      id: `letter-${letter === "#" ? "other" : letter.toLowerCase()}`,
      title: letter,
      description: countLabel,
      prospects: members,
    };
  });
}
