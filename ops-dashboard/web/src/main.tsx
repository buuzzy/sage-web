import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import { App } from './App';
import './style/global.css';
import '@ant-design/v5-patch-for-react-19';

// Match antd tokens to our CSS variables. Read them at runtime so a theme
// change via prefers-color-scheme stays in sync with the cards around the
// antd widgets.
function readVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: readVar('--series-1', '#3987e5'),
          colorBgContainer: readVar('--surface-card', '#1a1a19'),
          colorBgElevated: readVar('--surface-elevated', '#232321'),
          colorBorder: readVar('--border', 'rgba(255,255,255,0.10)'),
          colorText: readVar('--ink-primary', '#ffffff'),
          colorTextSecondary: readVar('--ink-secondary', '#c3c2b7'),
        },
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>,
);