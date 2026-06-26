import { SearchPanel } from "./components/SearchPanel";

export default function Home() {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Prospect Scout
            </span>
          </div>
          <span className="label-mono hidden sm:block">
            Opportunity Intelligence · Mock Feed
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-14 sm:py-20">
        <section className="max-w-3xl">
          <p className="label-mono text-accent-cyan">
            What you sell · Who buys it · Where to look
          </p>
          <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Find the prospects
            <br className="hidden sm:block" /> worth calling.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Tell Prospect Scout what you sell and who buys it. It finds likely
            opportunities, explains why they matter, and gives you a smarter
            reason to reach out.
          </p>
        </section>

        <div className="mt-14">
          <SearchPanel />
        </div>

        <footer className="mt-20 flex flex-col gap-1 border-t border-border pt-6">
          <p className="label-mono">Prospect Scout MVP</p>
          <p className="max-w-2xl text-xs leading-relaxed text-muted-2">
            Results use mock data. Architected to plug into free public sources
            — CMS, SEC EDGAR, Census, FDA, NPPES, Wikipedia, and news feeds —
            without changing the pipeline.
          </p>
        </footer>
      </main>
    </div>
  );
}
