import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/shared/providers/auth-provider';

export function LoginPage() {
  const { status, sendOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
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

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      await sendOtp(email.trim());
      setInfoMessage('验证码已发送到你的邮箱，请查收');
      setStep('code');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '发送验证码失败，请稍后重试'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      await verifyOtp(email.trim(), code.trim());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '验证码错误或已过期'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setCode('');
    setErrorMessage(null);
    setInfoMessage(null);
  };

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

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="flex flex-col gap-3">
            <div className="relative">
              <Mail className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" />
              <input
                type="email"
                inputMode="email"
                autoFocus
                autoComplete="email"
                placeholder="输入邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(
                  'border-border bg-background text-foreground placeholder:text-muted-foreground',
                  'h-11 w-full rounded-xl border pl-10 pr-4 text-sm outline-none',
                  'focus:border-primary focus:ring-1 focus:ring-primary transition-colors'
                )}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
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
              发送验证码
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-3">
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                autoComplete="one-time-code"
                placeholder="输入 6 位验证码"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={cn(
                  'border-border bg-background text-foreground placeholder:text-muted-foreground',
                  'h-11 w-full rounded-xl border px-4 text-center text-lg tracking-[0.5em] outline-none',
                  'focus:border-primary focus:ring-1 focus:ring-primary transition-colors'
                )}
              />
            </div>
            <button
              type="submit"
              disabled={loading || code.length < 6}
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
              验证并登录
            </button>
            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 text-xs transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              换一个邮箱
            </button>
          </form>
        )}
      </div>

      <p className="text-muted-foreground mt-8 text-xs tracking-wide">
        Sage · AI Financial Assistant
      </p>
    </div>
  );
}
