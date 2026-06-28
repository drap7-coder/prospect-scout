import Link from "next/link";
import { IndustryCatalog } from "@/app/components/IndustryCatalog";
import { ScoutBrand } from "@/app/components/ScoutLogo";
import { SoundToggle } from "@/app/components/SoundToggle";
import { ThemeToggle } from "@/app/components/ThemeToggle";

export const metadata = {
  title: "Industry Catalog | Prospect Scout",
  description:
    "Browse every industry Prospect Scout covers — warehouse intelligence and live discovery across healthcare, manufacturing, education, and more.",
};

export default function CatalogPage() {
  return (
    <div className="flex min-h-full flex-col bg-surface text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4 lg:px-8">
          <Link href="/" className="shrink-0">
            <ScoutBrand size={28} />
          </Link>
          <span className="label-mono hidden text-muted-2 sm:inline">
            Industry catalog
          </span>
          <div className="flex items-center gap-2">
            <SoundToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8 lg:py-10">
        <IndustryCatalog variant="page" />
      </main>
    </div>
  );
}
