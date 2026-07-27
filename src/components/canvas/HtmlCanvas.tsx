import { useEffect, useMemo, useRef } from 'react';
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

// Script injected into every iframe to track echarts instances and
// self-heal their dimensions when the iframe's internal layout settles.
// This handles the browser-refresh case where the panel transitions
// from hidden → visible and the iframe initially renders with a
// stale/zero width before CSS layout completes.
const ECHARTS_BOOTSTRAP = `<script>
(function(){
  var charts = [];
  var origInit = null;
  if (window.echarts) {
    origInit = echarts.init;
    echarts.init = function() {
      var c = origInit.apply(this, arguments);
      charts.push(c);
      return c;
    };
  }
  function resizeAll() {
    charts.forEach(function(c) { try { c.resize(); } catch(e) {} });
  }
  window.addEventListener('resize', resizeAll);
  // Poll for width stabilization. On first load the iframe viewport
  // width can be 0 or very small; we keep resizing until it stabilizes.
  var lastW = -1, stable = 0;
  var pollId = setInterval(function() {
    var w = document.documentElement.clientWidth || document.body.clientWidth || 0;
    if (w !== lastW) {
      lastW = w;
      stable = 0;
      resizeAll();
    } else {
      stable++;
    }
    if (stable >= 5) clearInterval(pollId);
  }, 80);
})();
</script>`;

interface HtmlCanvasProps {
  html: string;
}

export function HtmlCanvas({ html }: HtmlCanvasProps) {
  const { resolvedTheme, backgroundStyle } = useTheme();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
${ECHARTS_BOOTSTRAP}
${html}
</body>
</html>`;
  }, [html, resolvedTheme, backgroundStyle]);

  // Propagate parent resize events into the iframe as a backup signal.
  // The inner poll script is the primary mechanism; this covers edge
  // cases where the user drags the panel divider.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const iframe = iframeRef.current;
    if (!wrapper || !iframe) return;

    const triggerResize = () => {
      try {
        iframe.contentWindow?.dispatchEvent(new Event('resize'));
      } catch { /* cross-origin guard */ }
    };

    const ro = new ResizeObserver(() => triggerResize());
    ro.observe(wrapper);

    return () => ro.disconnect();
  }, [html]);

  return (
    <div ref={wrapperRef} className="size-full overflow-hidden">
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        key={html}
        sandbox="allow-scripts"
        className="size-full border-none"
        title="canvas"
      />
    </div>
  );
}
