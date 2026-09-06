import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/shared/providers/auth-provider';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * AuthGuard — 最外层守卫
 *
 * loading → 空白等待（避免闪烁）
 * unauthenticated → 跳转 /login
 * authenticated + dbReady → 渲染应用内容
 * authenticated + !dbReady → 继续显示 loading（SQLite 正在按 uid 绑定）
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { status, dbReady } = useAuth();

  if (status === 'loading' || (status === 'authenticated' && !dbReady)) {
    return (
      <div className="bg-background flex min-h-svh items-center justify-center">
        <div className="border-primary animate-spin rounded-full border-2 border-t-transparent p-3" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
