import { useLanguage } from '@/shared/providers/language-provider';

import { CURATED_SKILLS } from '@/shared/lib/skillLabels';

/**
 * Read-only skills panel. Capabilities are curated by the team and always
 * enabled. Users cannot search, add, toggle, or delete them.
 */
export function SkillsSettings() {
  const { t } = useLanguage();

  return (
    <div className="-m-6 h-[calc(100%+48px)] overflow-y-auto p-6">
      <div className="grid grid-cols-2 gap-4">
        {CURATED_SKILLS.map((skill) => (
          <div
            key={skill.id}
            className="border-border bg-background hover:border-foreground/20 relative flex flex-col rounded-xl border p-4 transition-colors"
          >
            <span className="text-foreground mb-2 min-w-0 truncate text-sm font-medium">
              {skill.name}
            </span>
            <p className="text-muted-foreground line-clamp-3 flex-1 text-xs">
              {skill.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
