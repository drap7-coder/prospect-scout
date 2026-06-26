const PRODUCTION_SITE_URL = "https://prospect-scout-henna.vercel.app";

/** Canonical public site URL for metadata and Open Graph assets. */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  // Use the stable production alias — not ephemeral *.vercel.app deployment URLs
  // (those can be SSO-gated and break link-preview crawlers).
  if (process.env.VERCEL_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return PRODUCTION_SITE_URL;
}
