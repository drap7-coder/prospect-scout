"use client";

import { IndustryCatalog } from "./IndustryCatalog";
import { HomeHeroSearchBar } from "./HomeHeroSearchBar";

export function HomeSearchHero() {
  return (
    <div className="mx-auto w-full max-w-5xl text-center">
      <div className="pt-[max(calc(env(safe-area-inset-top)+9.5rem),calc(env(safe-area-inset-top)+30svh))] sm:pt-[max(calc(env(safe-area-inset-top)+8.5rem),calc(env(safe-area-inset-top)+28svh))] lg:pt-[max(calc(env(safe-area-inset-top)+7.5rem),calc(env(safe-area-inset-top)+26svh))]">
        <h1 className="text-balance text-[2.6rem] font-bold leading-[1.02] tracking-[-0.03em] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.72)] sm:text-6xl lg:text-[4.25rem]">
          Find your next best opportunity.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-balance text-sm leading-relaxed text-white/75 drop-shadow-[0_1px_10px_rgba(0,0,0,0.5)] sm:text-base">
          Search any organization — warehouse intelligence where curated, live discovery everywhere else.
        </p>
      </div>

      <HomeHeroSearchBar />

      <section
        id="start"
        aria-labelledby="industry-catalog-heading"
        className="mx-auto mt-10 max-w-6xl scroll-mt-20 text-left sm:mt-12"
      >
        <p className="mb-4 text-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-white/45">
          Or browse by industry
        </p>
        <IndustryCatalog variant="homepage" />
      </section>
    </div>
  );
}
