import { ScoutBrand } from "./ScoutLogo";
import { SoundToggle } from "./SoundToggle";
import { ThemeToggle } from "./ThemeToggle";

const HERO_NAV_LINKS = [
  { label: "Solutions", href: "#" },
  { label: "Industries", href: "#start" },
  { label: "How It Works", href: "#" },
  { label: "Pricing", href: "#" },
] as const;

export function AppHeader({
  minimal = false,
  variant = "default",
  nav = false,
}: {
  minimal?: boolean;
  variant?: "default" | "hero";
  /** Renders the marketing navigation (logo, links, auth actions). */
  nav?: boolean;
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
        <div className="flex items-center gap-8">
          <ScoutBrand size={32} className={hero ? "[&_span]:text-white" : ""} />
          {nav ? (
            <nav
              aria-label="Primary"
              className="hidden items-center gap-6 text-sm lg:flex"
            >
              {HERO_NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="font-medium text-white/75 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
                >
                  {link.label}
                </a>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium text-white/75 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
              >
                Resources
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="m6 9 6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {!minimal && !nav ? (
            <p
              className={`hidden text-xs sm:block ${
                hero ? "text-white/65" : "text-muted"
              }`}
            >
              Organization discovery
            </p>
          ) : null}
          {nav ? (
            <>
              <a
                href="#"
                className="hidden rounded-full px-3 py-2 text-sm font-medium text-white/85 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 sm:inline-flex"
              >
                Sign in
              </a>
              <a
                href="#start"
                className="interactive-press inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(37,99,235,0.4)] transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
              >
                Get started
              </a>
            </>
          ) : null}
          <SoundToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
