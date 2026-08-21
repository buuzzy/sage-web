import { createBrowserRouter } from 'react-router-dom';
import { HomePage, LibraryPage, LoginPage, TaskDetailPage } from '@/app/pages';
import { RouteErrorElement } from '@/app/route-error-element';

import { AuthGuard } from '@/components/auth-guard';

const routes = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <HomePage />
      </AuthGuard>
    ),
  },
  {
    path: '/task/:taskId',
    element: (
      <AuthGuard>
        <TaskDetailPage />
      </AuthGuard>
    ),
  },
  {
    path: '/library',
    element: (
      <AuthGuard>
        <LibraryPage />
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
