import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/shared/providers/auth-provider';
import { ArrowLeft, KeyRound, Lock, Mail, TicketIcon } from 'lucide-react';

export function LoginPage() {
  const { status, signInWithEmail, signUpWithEmail, verifySignupOtp } =
    useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [regStep, setRegStep] = useState<'form' | 'code'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
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

  // ── Login handler ───────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '登录失败，请检查邮箱和密码'
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Register step 1: create account, send verification code ─────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) return;
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      await signUpWithEmail(email.trim(), password);
      setInfoMessage('验证码已发送到你的邮箱，请查收');
      setRegStep('code');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '注册失败，请稍后重试'
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Register step 2: verify code, get session ───────────────────────
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      await verifySignupOtp(email.trim(), code.trim(), inviteCode.trim());
      // verifyOtp with type 'signup' returns a session — onAuthStateChange fires
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '验证码错误或已过期'
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setRegStep('form');
    setCode('');
    setPassword('');
    setInviteCode('');
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const backToForm = () => {
    setRegStep('form');
    setCode('');
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const inputCls = cn(
    'border-border bg-background text-foreground placeholder:text-muted-foreground',
    'h-11 w-full rounded-xl border pl-10 pr-4 text-sm outline-none',
    'focus:border-primary focus:ring-1 focus:ring-primary transition-colors'
  );
  const btnCls = cn(
    'bg-primary text-primary-foreground',
    'inline-flex h-11 w-full items-center justify-center gap-2',
    'rounded-xl px-4 text-sm font-medium transition-all',
    'hover:opacity-90 active:scale-[0.98]',
    'disabled:cursor-not-allowed disabled:opacity-50'
  );

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center px-4">
      <div className="border-border/60 bg-card w-full max-w-xs rounded-2xl border p-8 shadow-lg">
        {/* Logo + Brand */}
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

        {/* ── Login mode ─────────────────────────────────────────────── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <div className="relative">
              <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <input
                type="email"
                inputMode="email"
                autoFocus
                autoComplete="email"
                placeholder="邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="relative">
              <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className={btnCls}
            >
              {loading ? (
                <div className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
              ) : null}
              登录
            </button>
          </form>
        )}

        {/* ── Register mode: step 1 (email + password) ───────────────── */}
        {mode === 'register' && regStep === 'form' && (
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <div className="relative">
              <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <input
                type="email"
                inputMode="email"
                autoFocus
                autoComplete="email"
                placeholder="邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="relative">
              <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="设置密码（至少 6 位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim() || password.length < 6}
              className={btnCls}
            >
              {loading ? (
                <div className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
              ) : null}
              注册并发送验证码
            </button>
          </form>
        )}

        {/* ── Register mode: step 2 (verification code) ──────────────── */}
        {mode === 'register' && regStep === 'code' && (
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
            <div className="relative">
              <KeyRound className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                autoComplete="one-time-code"
                placeholder="输入验证码"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={inputCls}
              />
            </div>
            <div className="relative">
              <TicketIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder="兑换码"
                value={inviteCode}
                onChange={(e) =>
                  setInviteCode(e.target.value.toUpperCase().slice(0, 20))
                }
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={loading || code.length < 6 || !inviteCode.trim()}
              className={btnCls}
            >
              {loading ? (
                <div className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
              ) : null}
              验证并进入
            </button>
            <button
              type="button"
              onClick={backToForm}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 text-xs transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              返回修改
            </button>
          </form>
        )}

        {/* ── Mode switch ─────────────────────────────────────────────── */}
        {!(mode === 'register' && regStep === 'code') && (
          <button
            type="button"
            onClick={switchMode}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground mt-4 w-full text-center text-xs transition-colors"
          >
            {mode === 'login' ? '还没有账号？点击注册' : '已有账号？点击登录'}
          </button>
        )}
      </div>

      <p className="text-muted-foreground mt-8 text-xs tracking-wide">
        Sage · AI Financial Assistant
      </p>
    </div>
  );
}
