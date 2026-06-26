import type { Prospect, SearchQuery } from "@/lib/search/types";

const STORAGE_KEY = "prospect-scout-workspace";

export interface WorkspaceSession {
  query: SearchQuery;
  prospects: Prospect[];
  savedAt: number;
}

export function saveWorkspace(session: WorkspaceSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* quota or private mode — dossier may not resolve */
  }
}

export function loadWorkspace(): WorkspaceSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceSession;
  } catch {
    return null;
  }
}

export function getProspectFromSession(id: string): Prospect | null {
  const session = loadWorkspace();
  if (!session) return null;
  return session.prospects.find((p) => p.id === id) ?? null;
}
