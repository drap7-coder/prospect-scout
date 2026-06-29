const GENERIC_LOCAL_PARTS = new Set([
  "info",
  "sales",
  "support",
  "careers",
  "privacy",
  "contact",
  "admin",
  "help",
  "hello",
  "marketing",
  "press",
  "media",
  "hr",
  "jobs",
  "recruiting",
  "billing",
  "customerservice",
  "customer",
  "service",
  "noreply",
  "no-reply",
  "donotreply",
  "webmaster",
  "postmaster",
  "abuse",
  "feedback",
  "team",
  "office",
  "enquiries",
  "inquiries",
  "general",
]);

/** True when the local part is a generic/shared inbox, not a person address. */
export function isGenericInboxLocalPart(localPart: string): boolean {
  const base = localPart.toLowerCase().split("+")[0]?.split(".")[0] ?? "";
  return GENERIC_LOCAL_PARTS.has(base);
}
