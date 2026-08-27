import { useState, useEffect, useCallback } from 'react';
import { AdminAuthError, clearToken, fetchMetrics, type AdminMetrics } from './api';
import { Unlock } from './unlock';
import { Dashboard } from './dashboard';

export function App() {
  const [token, setTokenState] = useState<string | null>(
    () => localStorage.getItem('sage_admin_token'),
  );
  const [data, setData] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await fetchMetrics();
      setData(m);
    } catch (e) {
      if (e instanceof AdminAuthError) {
        setAuthError('令牌无效或已过期，请重新输入');
        setTokenState(null);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token && !data) void load();
  }, [token, data, load]);

  if (!token) {
    return (
      <Unlock
        errorMessage={authError}
        onUnlocked={() => {
          setAuthError(null);
          setTokenState(localStorage.getItem('sage_admin_token'));
        }}
      />
    );
  }

  return (
    <Dashboard
      data={data}
      loading={loading}
      error={error}
      generatedAt={data?.generatedAt ?? null}
      onRefresh={() => void load()}
      onLogout={() => {
        clearToken();
        setTokenState(null);
        setData(null);
      }}
    />
  );
}