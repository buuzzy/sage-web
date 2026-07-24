import '@ant-design/v5-patch-for-react-19';

import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './app/router';
import { ErrorBoundary } from './components/error-boundary';
import { initializeSettings } from './shared/db/settings';
import { installFetchInterceptor } from './shared/lib/api/fetch-interceptor';
import { AntdThemeProvider } from './shared/providers/antd-theme-provider';
import { AuthProvider } from './shared/providers/auth-provider';
import { LanguageProvider } from './shared/providers/language-provider';
import { ThemeProvider } from './shared/providers/theme-provider';
import { UpdateProvider } from './shared/providers/update-provider';
import {
  flushErrorQueue,
  ProfileProvider,
  reportError,
  retryFailedChannels,
  SessionSyncProvider,
  SettingsSyncProvider,
} from './shared/sync';

import '@/config/style/global.css';

// Install global fetch interceptor to inject Bearer token for all API requests.
// Must run before any component renders / fetches.
installFetchInterceptor();

function AppProviders() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AntdThemeProvider>
          <AuthProvider>
            <ProfileProvider>
              <SettingsSyncProvider>
                <SessionSyncProvider>
                  <UpdateProvider>
                    <RouterProvider router={router} />
                  </UpdateProvider>
                </SessionSyncProvider>
              </SettingsSyncProvider>
            </ProfileProvider>
          </AuthProvider>
        </AntdThemeProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

function BootstrapRoot() {
  const [settingsReady, setSettingsReady] = useState(false);

  const boot = useCallback(async () => {
    try {
      await initializeSettings();
      setSettingsReady(true);
      void flushErrorQueue();
    } catch (error) {
      console.error('[startup] initializeSettings failed:', error);
      // Settings failure is non-fatal — render anyway with defaults
      setSettingsReady(true);
    }
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  if (!settingsReady) {
    // Brief blank screen while settings load (typically <50ms)
    return null;
  }

  return <AppProviders />;
}

// ─── Global error listeners ──────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('error', (ev) => {
    if (ev.message === 'Script error.') return;
    void reportError({
      error_type: 'window_error',
      message: ev.message || 'Unknown window error',
      stack_trace: ev.error?.stack,
      context: {
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
        url: window.location.href,
      },
    });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason;
    const message =
      (reason instanceof Error ? reason.message : null) ||
      (typeof reason === 'string' ? reason : null) ||
      'Unhandled promise rejection';
    void reportError({
      error_type: 'unhandled_rejection',
      message,
      stack_trace: reason instanceof Error ? reason.stack : undefined,
      context: {
        url: window.location.href,
        reason_type: typeof reason,
      },
    });
  });

  window.addEventListener('online', () => {
    console.log('[sync] window.online fired, retrying failed channels');
    void retryFailedChannels({ force: true });
    void flushErrorQueue();
  });

  const RETRY_POLL_MS = 5_000;
  setInterval(() => {
    void retryFailedChannels();
  }, RETRY_POLL_MS);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BootstrapRoot />
    </ErrorBoundary>
  </React.StrictMode>
);
