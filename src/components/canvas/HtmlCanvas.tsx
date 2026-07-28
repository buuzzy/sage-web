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
    if (!val) continue;
    // Custom properties return their raw value (e.g. oklch(...)).
    // ECharts canvas renderer can't parse oklch() on hover redraw,
    // causing lines to disappear. Resolve to rgb/rgba via a temp element
    // so injected values are always canvas-safe.
    if (val.startsWith('oklch') || val.startsWith('hsl') || val.startsWith('lab') || val.startsWith('lch')) {
      const probe = document.createElement('div');
      probe.style.color = val;
      document.body.appendChild(probe);
      const resolved = getComputedStyle(probe).color; // returns rgb(...) or rgba(...)
      document.body.removeChild(probe);
      lines.push(`  ${v}: ${resolved};`);
    } else {
      lines.push(`  ${v}: ${val};`);
    }
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
  // ─── Canvas color resolver ───────────────────────────────────
  // ECharts canvas renderer cannot parse oklch(). On hover, echarts
  // clears and redraws — invalid colors cause lines/bars to vanish.
  // We monkey-patch CanvasRenderingContext2D to resolve oklch/hsl/lab/
  // lch/var() to rgb before they reach the canvas.
  var _probe = document.createElement('div');
  _probe.style.cssText = 'position:absolute;left:-9999px;width:0;height:0';
  
  function oklchToRgb(L, C, H) {
    var hRad = H * Math.PI / 180;
    var a = C * Math.cos(hRad), b = C * Math.sin(hRad);
    var l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    var s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    var l = l_*l_*l_, m = m_*m_*m_, s = s_*s_*s_;
    var r =  4.0767416621*l - 3.3077115913*m + 0.2309699292*s;
    var g = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s;
    var bl= -0.0041960863*l - 0.7034186147*m + 1.7076147010*s;
    function gam(c){return c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055;}
    return [Math.round(Math.max(0,Math.min(255,gam(r)*255))),
            Math.round(Math.max(0,Math.min(255,gam(g)*255))),
            Math.round(Math.max(0,Math.min(255,gam(bl)*255)))];
  }
  
  function resolveColor(val) {
    if (typeof val !== 'string') return val;
    // Fast path: already canvas-safe
    if (/^(rgb|rgba|#|none|transparent)/i.test(val)) return val;
    // Resolve var(--xxx) via computed style
    if (val.indexOf('var(') !== -1) {
      _probe.style.color = '';
      _probe.style.color = val;
      var cv = getComputedStyle(_probe).color;
      if (/^rgb/i.test(cv)) return cv;
      val = cv;
    }
    // Parse and convert oklch()
    var m = val.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (m) {
      var rgb = oklchToRgb(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
      return 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
    }
    // Fallback: try DOM resolution for hsl/lab/lch
    if (/hsl|lab|lch/i.test(val)) {
      _probe.style.color = '';
      _probe.style.color = val;
      var dv = getComputedStyle(_probe).color;
      if (/^rgb/i.test(dv)) return dv;
    }
    return val;
  }
  
  // Monkey-patch canvas context setters
  if (typeof CanvasRenderingContext2D !== 'undefined') {
    var descS = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'strokeStyle');
    var descF = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle');
    if (descS && descS.set) {
      Object.defineProperty(CanvasRenderingContext2D.prototype, 'strokeStyle', {
        set: function(v) { descS.set.call(this, resolveColor(v)); },
        get: function() { return descS.get.call(this); }
      });
    }
    if (descF && descF.set) {
      Object.defineProperty(CanvasRenderingContext2D.prototype, 'fillStyle', {
        set: function(v) { descF.set.call(this, resolveColor(v)); },
        get: function() { return descF.get.call(this); }
      });
    }
  }
  document.body.appendChild(_probe);
  
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

// Intercepts link clicks inside the iframe and opens them in a new tab.
// Without this, sandboxed iframes either silently swallow navigation
// or browsers show "blocked" warnings.
const LINK_HANDLER = `<script>
(function(){
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (!a || !a.href) return;
    e.preventDefault();
    window.open(a.href, '_blank');
  });
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
${LINK_HANDLER}
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
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        className="size-full border-none"
        title="canvas"
      />
    </div>
  );
}
