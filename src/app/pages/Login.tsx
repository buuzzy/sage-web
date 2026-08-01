import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/shared/providers/auth-provider';

export function LoginPage() {
  const { status, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <div className="bg-background flex min-h-svh items-center justify-center px-4">
        <div className="border-border/60 bg-card flex w-full max-w-xs flex-col items-center rounded-2xl border p-8 shadow-lg">
          <div className="border-border/20 border-t-primary mb-4 size-6 animate-spin rounded-full border-2" />
          <p className="text-muted-foreground text-sm">正在检查登录状态…</p>
        </div>
      </div>
    );
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      if (mode === 'login') {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password);
        setInfoMessage('注册成功！验证邮件已发送到你的邮箱，请点击邮件中的链接完成验证后登录。');
        setMode('login');
        setPassword('');
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '操作失败，请稍后重试'
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setErrorMessage(null);
    setInfoMessage(null);
  };

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center px-4">
      <div className="border-border/60 bg-card w-full max-w-xs rounded-2xl border p-8 shadow-lg">
        <div className="mb-10 flex flex-col items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-b from-white to-gray-50 p-3 shadow-sm ring-1 ring-black/5 dark:from-gray-800 dark:to-gray-900 dark:ring-white/10">
            <img
              src="/logo.png"
              alt="Sage"
              className="size-20 rounded-xl object-contain"
            />
          </div>
          <div className="text-center">
            <h1 className="text-foreground font-serif text-3xl font-normal tracking-tight">
              Sage
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">智能金融助手</p>
          </div>
        </div>

        {errorMessage && (
          <div className="border-destructive/30 bg-destructive/5 text-destructive mb-4 rounded-lg border px-3 py-2 text-xs">
            {errorMessage}
          </div>
        )}

        {infoMessage && (
          <div className="border-primary/30 bg-primary/5 text-primary mb-4 rounded-lg border px-3 py-2 text-xs">
            {infoMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <Mail className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" />
            <input
              type="email"
              inputMode="email"
              autoFocus
              autoComplete="email"
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                'border-border bg-background text-foreground placeholder:text-muted-foreground',
                'h-11 w-full rounded-xl border pl-10 pr-4 text-sm outline-none',
                'focus:border-primary focus:ring-1 focus:ring-primary transition-colors'
              )}
            />
          </div>

          <div className="relative">
            <Lock className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" />
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className={cn(
                'border-border bg-background text-foreground placeholder:text-muted-foreground',
                'h-11 w-full rounded-xl border pl-10 pr-4 text-sm outline-none',
                'focus:border-primary focus:ring-1 focus:ring-primary transition-colors'
              )}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className={cn(
              'bg-primary text-primary-foreground',
              'inline-flex h-11 w-full items-center justify-center gap-2',
              'rounded-xl px-4 text-sm font-medium transition-all',
              'hover:opacity-90 active:scale-[0.98]',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {loading ? (
              <div className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
            ) : null}
            {mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground mt-4 w-full text-center text-xs transition-colors"
        >
          {mode === 'login' ? '还没有账号？点击注册' : '已有账号？点击登录'}
        </button>
      </div>

      <p className="text-muted-foreground mt-8 text-xs tracking-wide">
        Sage · AI Financial Assistant
      </p>
    </div>
  );
}
