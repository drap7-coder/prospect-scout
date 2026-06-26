import type { ProviderId, SearchQuery, SourcePlan } from "@/lib/search/types";
import { resolveProviders } from "@/lib/taxonomy";

/**
 * Decides which taxonomy target and data providers a search should hit.
 *
 * Provider routing is taxonomy-driven:
 *   - SEC EDGAR — public companies across sectors
 *   - CMS — healthcare payers and providers
 *   - FDA / openFDA — life sciences, food, pharma, device, manufacturing
 *   - RSS — broad press-release fallback
 *   - Public Web — regional directory intelligence
 *   - Mock / master directory — always the baseline
 */
export function planSources(query: SearchQuery): SourcePlan {
  const pack = query.profile.targetBuyer;
  const providers = resolveProviders({
    taxonomyTarget: pack,
    queryText: `${query.targets} ${query.profile.whatTheySell}`.trim(),
  }) as ProviderId[];

  return {
    query,
    buyerPacks: [pack],
    providers,
  };
}
