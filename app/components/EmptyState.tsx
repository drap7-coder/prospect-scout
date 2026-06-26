import { MeridianMark } from "./ScoutMeridian";

export function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface/50 px-6 py-20 text-center">
      <div className="relative mx-auto flex h-14 w-14 items-center justify-center">
        <MeridianMark className="h-8 w-8 text-accent-cyan/80" />
        <span className="absolute inset-0 rounded-full bg-accent-cyan/5 blur-xl" />
      </div>
      <p className="mt-6 text-sm font-medium tracking-tight text-foreground">
        Awaiting signal resolution
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        Define your offering and buyer ecosystem. Ranked prospects with source
        trails will resolve here.
      </p>
    </div>
  );
}
