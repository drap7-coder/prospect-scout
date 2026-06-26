"use client";

import { InteractionProvider } from "./components/InteractionProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <InteractionProvider>{children}</InteractionProvider>;
}
