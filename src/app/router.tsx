import { createBrowserRouter } from 'react-router-dom';
import {
  HomePage,
  LibraryPage,
  LoginPage,
  SetupPage,
  TaskDetailPage,
} from '@/app/pages';

import { AuthGuard } from '@/components/auth-guard';
import { SetupGuard } from '@/components/setup-guard';
import { RouteErrorElement } from '@/app/route-error-element';

const routes = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <SetupGuard>
          <HomePage />
        </SetupGuard>
      </AuthGuard>
    ),
  },
  {
    path: '/task/:taskId',
    element: (
      <AuthGuard>
        <SetupGuard>
          <TaskDetailPage />
        </SetupGuard>
      </AuthGuard>
    ),
  },
  {
    path: '/library',
    element: (
      <AuthGuard>
        <SetupGuard>
          <LibraryPage />
        </SetupGuard>
      </AuthGuard>
    ),
  },
  {
    path: '/setup',
    element: <SetupPage />,
  },
];

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorElement />,
    children: routes,
  },
]);
