import { useMemo } from 'react';
import { useTheme } from '@/shared/providers/theme-provider';

// Inline echarts runtime (~1.1MB, loaded once at module level).
import echartsSource from 'echarts/dist/echarts.min.js?raw';

const THEME_VARS = [
  '--background', '--foreground', '--card', '--card-foreground',
  '--primary', '--primary-foreground', '--secondary', '--secondary-foreground',
  '--muted', '--muted-foreground', '--accent', '--accent-foreground',
  '--destructive', '--destructive-foreground', '--border', '--input',
  '--ring', '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
  '--font-sans', '--radius',
];

function readThemeVars(): string {
  const style = getComputedStyle(document.documentElement);
  const lines: string[] = [];
  for (const v of THEME_VARS) {
    const val = style.getPropertyValue(v).trim();
    if (val) lines.push(`  ${v}: ${val};`);
  }
  return lines.join('\n');
}

interface HtmlCanvasProps {
  html: string;
}

export function HtmlCanvas({ html }: HtmlCanvasProps) {
  const { resolvedTheme, backgroundStyle } = useTheme();

  const srcDoc = useMemo(() => {
    const vars = readThemeVars();
    const isFullDoc = /^\s*<!doctype|^\s*<html/i.test(html);

    if (isFullDoc) return html;

    return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root {
${vars}
}
* { box-sizing: border-box; }
body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  margin: 0;
  padding: 16px;
  font-size: 14px;
  line-height: 1.6;
}
a { color: var(--primary); }
</style>
<script>${echartsSource}</script>
</head>
<body>
${html}
</body>
</html>`;
  }, [html, resolvedTheme, backgroundStyle]);

  return (
    <iframe
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      style={{ width: '100%', height: '100%', border: 'none' }}
      title="canvas"
    />
  );
}
