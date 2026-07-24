/**
 * UpdateProvider — Web-safe no-op updater state
 *
 * Sage Web 暂不做自动更新链路。这个 Provider 保留同一套 UI 接口，
 * 但在浏览器里只提供“当前已是最新”的静态状态。
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error';

export interface Update {
  version: string;
  body?: string | null;
  date?: string | null;
}

export interface UpdateState {
  status: UpdateStatus;
  update: Update | null;
  latestVersion: string | null;
  notes: string | null;
  progress: number | null;
  dismissedVersion: string | null;
  errorMessage: string | null;
  aboutSeenVersion: string | null;
}

interface UpdateContextType extends UpdateState {
  checkForUpdates: () => Promise<boolean>;
  downloadAndInstall: () => Promise<void>;
  dismiss: () => void;
  markAboutSeen: () => void;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UpdateState>({
    status: 'up-to-date',
    update: null,
    latestVersion: null,
    notes: null,
    progress: null,
    dismissedVersion: null,
    errorMessage: null,
    aboutSeenVersion: null,
  });

  const checkForUpdates = useCallback(async (): Promise<boolean> => {
    setState((s) => ({
      ...s,
      status: 'up-to-date',
      errorMessage: null,
    }));
    return false;
  }, []);

  const downloadAndInstall = useCallback(async (): Promise<void> => {
    setState((s) => ({
      ...s,
      status: 'up-to-date',
      errorMessage: 'Web 版暂不支持自动更新。',
    }));
  }, []);

  const dismiss = useCallback(() => {
    setState((s) =>
      s.latestVersion ? { ...s, dismissedVersion: s.latestVersion } : s
    );
  }, []);

  const markAboutSeen = useCallback(() => {
    setState((s) =>
      s.latestVersion ? { ...s, aboutSeenVersion: s.latestVersion } : s
    );
  }, []);

  const value = useMemo<UpdateContextType>(
    () => ({
      ...state,
      checkForUpdates,
      downloadAndInstall,
      dismiss,
      markAboutSeen,
    }),
    [state, checkForUpdates, downloadAndInstall, dismiss, markAboutSeen]
  );

  return (
    <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
  );
}

export function useUpdate(): UpdateContextType {
  const context = useContext(UpdateContext);
  if (context === undefined) {
    throw new Error('useUpdate must be used inside <UpdateProvider>');
  }
  return context;
}
