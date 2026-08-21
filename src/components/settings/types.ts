import type { Settings } from '@/shared/db/settings';

// Settings category type
export type SettingsCategory =
  | 'account'
  | 'general'
  | 'skills'
  | 'persona'
  | 'about';

// Common props for settings tabs
export interface SettingsTabProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}
