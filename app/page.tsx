import { HomeSearchHero } from "./components/HomeSearchHero";
import { ScoutBrand } from "./components/ScoutLogo";
import { ScoutMeridian } from "./components/ScoutMeridian";

const SOURCES = ["CMS", "SEC EDGAR", "openFDA", "Public Web", "Press feeds"];

export default function Home() {
  return (
    <div className="relative min-h-full overflow-x-hidden">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
      >
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_600px_at_50%_20%,rgba(56,224,216,0.07),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_500px_at_80%_70%,rgba(61,139,255,0.05),transparent_70%)]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[3.75rem] w-full max-w-[88rem] items-center justify-between px-6 lg:px-10">
          <ScoutBrand size={36} />
          <p className="label-mono hidden text-muted-2 sm:block">
            Organization discovery · Signal intelligence
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[88rem] px-6 lg:px-10">
        <section className="relative flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center py-16 lg:py-20">
          {/* Meridian backdrop */}
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.35] lg:opacity-45"
            aria-hidden
          >
            <div className="aspect-[5/7] h-[min(70vh,520px)] w-auto max-w-[420px]">
              <ScoutMeridian className="h-full w-full" />
            </div>
          </div>

          <HomeSearchHero />
        </section>

        <section className="border-t border-border/60 py-10">
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {SOURCES.map((source) => (
              <li key={source} className="label-mono text-muted-2">
                {source}
              </li>
            ))}
          </ul>
        </section>

        <footer className="flex flex-col gap-3 border-t border-border/60 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="label-mono text-muted-2">
            Prospect Scout · {new Date().getFullYear()}
          </p>
          <p className="max-w-md text-xs leading-relaxed text-muted-2">
            Ranked by signal strength, freshness, and organizational fit.
          </p>
        </footer>
      </main>
    </div>
  );
}
