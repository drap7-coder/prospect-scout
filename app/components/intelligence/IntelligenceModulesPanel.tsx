"use client";

import type {
  IntelligenceModuleId,
  OrganizationIntelligenceProfile,
} from "@/lib/intelligence/framework/types";
import { IntelligenceModuleSummary } from "./IntelligenceModuleSummary";

export function IntelligenceModulesPanel({
  profile,
  selectedModuleId,
  onSelectModule,
  compact = false,
}: {
  profile?: OrganizationIntelligenceProfile;
  selectedModuleId?: IntelligenceModuleId | null;
  onSelectModule?: (moduleId: IntelligenceModuleId) => void;
  compact?: boolean;
}) {
  if (!profile?.modules.length) return null;

  return (
    <div className="intel-modules-panel">
      {profile.modules.map((module) => (
        <IntelligenceModuleSummary
          key={module.id}
          module={module}
          compact={compact}
          selected={selectedModuleId === module.id}
          onSelect={() => onSelectModule?.(module.id)}
        />
      ))}
    </div>
  );
}
