import { AppHeader } from "./components/AppHeader";
import { HomeSearchHero } from "./components/HomeSearchHero";

export default function Home() {
  return (
    <div className="min-h-full bg-background">
      <AppHeader minimal />
      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-10 sm:px-6 sm:pt-14">
        <HomeSearchHero />
      </main>
    </div>
  );
}
