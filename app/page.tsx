import Image from "next/image";
import { HomeSearchHero } from "./components/HomeSearchHero";

export default function Home() {
  return (
    <div className="relative min-h-full bg-[#020b16] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[min(58svh,580px)] overflow-hidden sm:h-[min(72svh,820px)] lg:h-[min(82svh,980px)]"
      >
        <div className="relative h-full w-full">
          <Image
            src="/prospect-scout-hero-v2.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[50%_10%] sm:object-[50%_12%] lg:object-[50%_16%]"
          />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(45,212,191,0.12),transparent_36%),linear-gradient(180deg,rgba(2,11,22,0.05)_0%,rgba(2,11,22,0.22)_28%,rgba(2,11,22,0.72)_52%,rgba(2,11,22,0.94)_78%,#020b16_100%)]" />
        <div className="motion-safe:animate-pulse absolute left-1/2 top-[8%] h-32 w-32 -translate-x-1/2 rounded-full bg-cyan-300/10 blur-3xl sm:top-[10%] sm:h-40 sm:w-40" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col justify-start px-5 pb-[max(4rem,env(safe-area-inset-bottom))] pt-[max(env(safe-area-inset-top),0px)] sm:px-6 sm:pb-20">
        <HomeSearchHero />
      </main>
    </div>
  );
}
