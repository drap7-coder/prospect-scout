/** Resolve MX host to a human-readable provider label (DNS only — no SMTP probing). */
export function mxProviderFromHosts(hosts: string[]): string | null {
  if (hosts.length === 0) return null;
  const joined = hosts.join(" ").toLowerCase();

  if (joined.includes("google") || joined.includes("gmail")) return "Google Workspace";
  if (
    joined.includes("outlook") ||
    joined.includes("microsoft") ||
    joined.includes("protection.outlook")
  ) {
    return "Microsoft 365";
  }
  if (joined.includes("mimecast")) return "Mimecast";
  if (joined.includes("proofpoint") || joined.includes("pphosted")) {
    return "Proofpoint";
  }
  if (joined.includes("messagelabs") || joined.includes("symantec")) {
    return "Broadcom Email Security";
  }
  if (joined.includes("yahoo")) return "Yahoo";
  if (joined.includes("zoho")) return "Zoho Mail";
  if (joined.includes("fastmail")) return "Fastmail";

  return hosts[0] ?? null;
}

export async function lookupMxProvider(domain: string): Promise<string | null> {
  try {
    const dns = await import("node:dns/promises");
    const records = await dns.resolveMx(domain);
    const hosts = records
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.exchange);
    return mxProviderFromHosts(hosts);
  } catch {
    return null;
  }
}
