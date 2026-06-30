export function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeMatchText(value: string): string[] {
  return normalizeMatchText(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}
