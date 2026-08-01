import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { bindUserId, unbindUser } from '@/shared/db/database';
import { reloadSettingsForCurrentUser } from '@/shared/db/settings';
import { USE_LOCAL_SQLITE } from '@/config';
import { supabase, type Session, type User } from '@/shared/lib/supabase';
import {
  startMessageSyncWorker,
  stopMessageSyncWorker,
} from '@/shared/sync/messages-sync';

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  status: AuthStatus;
  /**
   * 本地 user-scoped DB 是否已绑定成功。
   *
   * 对 Web 端来说，默认走 IndexedDB + Supabase，同样保留这个状态是为了
   * 让 AuthGuard / SetupGuard 的行为和 macOS 版本保持一致。
   */
  dbReady: boolean;
  dbError: string | null;
  retryDbBind: () => Promise<void>;
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * 从 localStorage 里 Supabase 缓存的 session token 中解析出 user.id。
 *
 * 这个兜底用于：Supabase getSession() 在刷新 token 时短暂卡住，
 * 但用户已经有本地 session 缓存的情况下，尽快放行 UI。
 */
function parseUidFromLocalSession(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) {
        continue;
      }
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const userId = (parsed as { user?: { id?: string } })?.user?.id;
      if (typeof userId === 'string' && userId.length > 0) {
        return userId;
      }

      const token = (parsed as { access_token?: string })?.access_token;
      if (typeof token === 'string') {
        const parts = token.split('.');
        if (parts.length === 3) {
          try {
            const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const pad =
              b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
            const payload = JSON.parse(atob(b64 + pad));
            if (typeof payload.sub === 'string') return payload.sub;
          } catch {
            /* fall through */
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let lastBoundUid: string | null = null;

    const switchDbTo = async (uid: string | null) => {
      if (uid === lastBoundUid && uid !== null) return;

      if (uid === null) {
        lastBoundUid = null;
        setDbError(null);
        stopMessageSyncWorker();
        try {
          await unbindUser();
        } catch (err) {
          console.error('[Auth] unbindUser failed:', err);
        }
        if (!cancelled) setDbReady(false);
        return;
      }

      try {
        setDbError(null);
        if (!cancelled) setDbReady(false);
        await bindUserId(uid);
        await reloadSettingsForCurrentUser();
        lastBoundUid = uid;
        if (!cancelled) setDbReady(true);
        startMessageSyncWorker();

        if (!USE_LOCAL_SQLITE) {
          try {
            const { incrementalCloudSync } = await import(
              '@/shared/sync/cloud-restore'
            );
            await incrementalCloudSync();
          } catch (err) {
            console.warn('[Auth] Cloud sync failed (non-blocking):', err);
          }
        }
      } catch (err) {
        console.error('[Auth] bindUserId failed:', err);
        if (!cancelled) {
          setDbReady(false);
          setDbError(
            err instanceof Error ? err.message : 'Failed to bind local database'
          );
        }
      }
    };

    const TIMEOUT_MS = 3000;
    let resolvedByTimeout = false;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      resolvedByTimeout = true;
      const cachedUid = parseUidFromLocalSession();
      console.warn(
        `[Auth] getSession still pending after ${TIMEOUT_MS}ms; using localStorage fallback (uid: ${
          cachedUid ? cachedUid.slice(0, 8) + '…' : 'none'
        })`
      );
      if (cachedUid) {
        void switchDbTo(cachedUid);
        setStatus('authenticated');
      } else {
        setStatus('unauthenticated');
      }
    }, TIMEOUT_MS);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        clearTimeout(timeoutId);
        if (cancelled) return;
        if (resolvedByTimeout) {
          console.log('[Auth] getSession resolved after timeout fallback');
        }
        setSession(session);
        setUser(session?.user ?? null);
        setStatus(session ? 'authenticated' : 'unauthenticated');
        void switchDbTo(session?.user?.id ?? null);
      })
      .catch((err) => {
        console.error('[Auth] getSession failed:', err);
        clearTimeout(timeoutId);
        if (cancelled) return;
        setSession(null);
        setUser(null);
        setStatus('unauthenticated');
        void switchDbTo(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');
      void switchDbTo(nextSession?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
      stopMessageSyncWorker();
    };
  }, []);

  const sendOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) throw error;
  }, []);

  const verifyOtp = useCallback(
    async (email: string, token: string) => {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });
      if (error) throw error;
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const retryDbBind = useCallback(async () => {
    const uid = user?.id;
    if (!uid) return;

    setDbError(null);
    setDbReady(false);
    try {
      await bindUserId(uid);
      await reloadSettingsForCurrentUser();
      setDbReady(true);
      startMessageSyncWorker();
    } catch (err) {
      console.error('[Auth] retryDbBind failed:', err);
      setDbReady(false);
      setDbError(
        err instanceof Error ? err.message : 'Failed to bind local database'
      );
    }
  }, [user?.id]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        status,
        dbReady,
        dbError,
        retryDbBind,
        sendOtp,
        verifyOtp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
