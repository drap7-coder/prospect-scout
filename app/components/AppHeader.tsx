import { ScoutBrand } from "./ScoutLogo";
import { SoundToggle } from "./SoundToggle";
import { ThemeToggle } from "./ThemeToggle";

export function AppHeader({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-5 sm:px-6">
        <ScoutBrand size={32} />
        <div className="flex items-center gap-3">
          {!minimal ? (
            <p className="hidden text-xs text-muted sm:block">
              Organization discovery
            </p>
          ) : null}
          <SoundToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
