import { ScoutBrand } from "./ScoutLogo";
import { SoundToggle } from "./SoundToggle";
import { ThemeToggle } from "./ThemeToggle";

export function AppHeader({
  minimal = false,
  variant = "default",
}: {
  minimal?: boolean;
  variant?: "default" | "hero";
}) {
  const hero = variant === "hero";

  return (
    <header
      className={`sticky top-0 z-20 backdrop-blur-md transition-colors ${
        hero
          ? "border-b border-white/10 bg-[#020b16]/42 text-white shadow-[0_1px_0_rgba(255,255,255,0.04)]"
          : "border-b border-border bg-surface/90"
      }`}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 sm:px-6">
        <ScoutBrand
          size={32}
          className={hero ? "[&_span]:text-white" : ""}
        />
        <div className="flex items-center gap-3">
          {!minimal ? (
            <p
              className={`hidden text-xs sm:block ${
                hero ? "text-white/65" : "text-muted"
              }`}
            >
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
