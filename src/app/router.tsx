import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { RouteErrorElement } from '@/app/route-error-element';

import { AuthGuard } from '@/components/auth-guard';

const HomePage = lazy(() =>
  import('@/app/pages/Home').then(({ HomePage }) => ({ default: HomePage }))
);
const TaskDetailPage = lazy(() =>
  import('@/app/pages/TaskDetail').then(({ TaskDetailPage }) => ({
    default: TaskDetailPage,
  }))
);
const LibraryPage = lazy(() =>
  import('@/app/pages/Library').then(({ LibraryPage }) => ({
    default: LibraryPage,
  }))
);
const LoginPage = lazy(() =>
  import('@/app/pages/Login').then(({ LoginPage }) => ({ default: LoginPage }))
);

function RouteLoading() {
  return (
    <div className="bg-background flex min-h-svh items-center justify-center">
      <div className="border-primary animate-spin rounded-full border-2 border-t-transparent p-3" />
    </div>
  );
}

const routes = [
  {
    path: '/login',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <Suspense fallback={<RouteLoading />}>
          <HomePage />
        </Suspense>
      </AuthGuard>
    ),
  },
  {
    path: '/task/:taskId',
    element: (
      <AuthGuard>
        <Suspense fallback={<RouteLoading />}>
          <TaskDetailPage />
        </Suspense>
      </AuthGuard>
    ),
  },
  {
    path: '/library',
    element: (
      <AuthGuard>
        <Suspense fallback={<RouteLoading />}>
          <LibraryPage />
        </Suspense>
      </AuthGuard>
    ),
  },
];

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorElement />,
    children: routes,
  },
]);
