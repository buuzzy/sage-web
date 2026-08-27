import { useState } from 'react';
import { Lock } from 'lucide-react';
import { setToken } from './api';

export function Unlock({
  onUnlocked,
  errorMessage,
}: {
  onUnlocked: () => void;
  errorMessage?: string | null;
}) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || submitting) return;
    setSubmitting(true);
    setToken(value.trim());
    onUnlocked();
    // Unlock is purely a local-storage write; the next metrics fetch will
    // confirm/deny. Don't pre-validate here.
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border p-8 shadow-sm"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Lock size={20} style={{ color: 'var(--ink-secondary)' }} />
          <h1 className="text-lg font-semibold">Sage 运营看板</h1>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--ink-secondary)' }}>
          请输入管理令牌解锁
        </p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="管理令牌"
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
          style={{
            background: 'var(--surface-elevated)',
            borderColor: errorMessage ? 'var(--status-serious)' : 'var(--border)',
            color: 'var(--ink-primary)',
          }}
        />
        {errorMessage && (
          <p className="mt-2 text-xs" style={{ color: 'var(--status-serious)' }}>
            {errorMessage}
          </p>
        )}
        <button
          type="submit"
          disabled={!value.trim()}
          className="mt-4 w-full rounded-lg py-2 text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: 'var(--series-1)', color: '#ffffff' }}
        >
          {submitting ? '解锁中…' : '解锁'}
        </button>
      </form>
    </div>
  );
}