import type { ComponentType } from 'react';
import { Brain, Info, Settings, Sparkles, User } from 'lucide-react';

import type { SettingsCategory } from './types';

// Category icons mapping
export const categoryIcons: Record<
  SettingsCategory,
  ComponentType<{ className?: string }>
> = {
  account: User,
  general: Settings,
  skills: Sparkles,
  persona: Brain,
  about: Info,
};
