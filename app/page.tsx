import Image from "next/image";
import { AppHeader } from "./components/AppHeader";
import { HomeSearchHero } from "./components/HomeSearchHero";

export default function Home() {
  return (
    <div className="relative min-h-full overflow-hidden bg-[#020b16] text-white">
      <Image
        src="/prospect-scout-hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 object-cover object-[50%_18%] opacity-95 sm:object-center"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(45,212,191,0.14),transparent_30%),linear-gradient(180deg,rgba(2,11,22,0.05)_0%,rgba(2,11,22,0.3)_38%,rgba(2,11,22,0.88)_76%,#020b16_100%)]"
        aria-hidden
      />
      <div
        className="motion-safe:animate-pulse absolute left-1/2 top-[20%] h-40 w-40 -translate-x-1/2 rounded-full bg-cyan-300/10 blur-3xl"
        aria-hidden
      />
      <AppHeader minimal variant="hero" />
      <main className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-6xl items-end px-5 pb-10 pt-24 sm:px-6 sm:pb-14 lg:pb-20">
        <HomeSearchHero />
      </main>
    </div>
  );
}
