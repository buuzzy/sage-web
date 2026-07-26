import { useEffect, useState } from 'react';
import { apiFetch } from '@/shared/lib/api';
import { getSkillLabel } from '@/shared/lib/skillLabels';
import { useLanguage } from '@/shared/providers/language-provider';
import { Loader2 } from 'lucide-react';

import { API_BASE_URL } from '../constants';
import type { SkillInfo } from '../types';

// Read-only skill card: name + description only, no controls.
function SkillCard({ skill }: { skill: SkillInfo }) {
  const { t } = useLanguage();
  const label = getSkillLabel(skill.name);
  return (
    <div className="border-border bg-background hover:border-foreground/20 relative flex flex-col rounded-xl border p-4 transition-colors">
      <span className="text-foreground mb-2 min-w-0 truncate text-sm font-medium">
        {label.name}
      </span>
      <p className="text-muted-foreground line-clamp-3 flex-1 text-xs">
        {label.description || t.settings.skillsNoDescription}
      </p>
    </div>
  );
}

/**
 * Read-only skills panel for the web app. Skills are curated by the team and
 * always enabled; users cannot search, add, toggle, or delete them. Each skill
 * is shown with a plain Chinese name and a capability-focused description
 * (no vendor/brand references) resolved from skillLabels.
 */
export function SkillsSettings() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  const loadSkills = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/skills`);
      const data = await response.json();
      if (data.success && Array.isArray(data.skills)) {
        setSkills(data.skills);
      }
    } catch (err) {
      console.error('[Skills] Failed to load skills:', err);
      setSkills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  if (loading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        {t.common.loading}
      </div>
    );
  }

  return (
    <div className="-m-6 h-[calc(100%+48px)] overflow-y-auto p-6">
      {skills.length === 0 ? (
        <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
          {t.settings.skillsEmpty}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {skills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}
    </div>
  );
}
