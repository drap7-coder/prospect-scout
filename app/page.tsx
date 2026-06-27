import Image from "next/image";
import { AppHeader } from "./components/AppHeader";
import { HomeSearchHero } from "./components/HomeSearchHero";

export default function Home() {
  return (
    <div className="relative min-h-full bg-[#020b16] text-white">
      {/* Fixed-height backdrop — stays stable when the builder expands below */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[min(52svh,480px)] overflow-hidden sm:h-[min(68svh,720px)] lg:h-[min(78svh,880px)]"
      >
        <div className="relative h-full w-full">
          <Image
            src="/prospect-scout-hero-v2.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[50%_38%] sm:object-[50%_24%] lg:object-[50%_28%]"
          />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(45,212,191,0.12),transparent_32%),linear-gradient(180deg,rgba(2,11,22,0.12)_0%,rgba(2,11,22,0.45)_42%,rgba(2,11,22,0.92)_78%,#020b16_100%)]" />
        <div className="motion-safe:animate-pulse absolute left-1/2 top-[12%] h-32 w-32 -translate-x-1/2 rounded-full bg-cyan-300/10 blur-3xl sm:top-[18%] sm:h-40 sm:w-40" />
      </div>
      <AppHeader minimal variant="hero" nav />
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-6xl flex-col justify-start px-5 pb-16 pt-10 sm:justify-center sm:px-6 sm:pb-20 sm:pt-20">
        <HomeSearchHero />
      </main>
    </div>
  );
}
