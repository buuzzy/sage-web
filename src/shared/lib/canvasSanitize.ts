/**
 * Canvas HTML sanitization — strips external `<script src>` references.
 *
 * The canvas runtime (HtmlCanvas) injects echarts into the iframe and
 * monkey-patches `echarts.init` to track chart instances for its dimension
 * self-heal (the iframe can start at 0/small width before CSS layout
 * settles). A second echarts loaded from a CDN overwrites `window.echarts`,
 * so charts created through it escape the self-heal and stay squeezed at
 * their init width forever. AGENTS.md already tells the model echarts is
 * injected, but LLM compliance is not guaranteed — enforce it at the
 * rendering choke point instead (both the render_canvas tool path and the
 * legacy `canvas:html` code-block path funnel through HtmlCanvas).
 */

/** Matches `<script ... src=...></script>` and the self-closing variant. */
const EXTERNAL_SCRIPT_RE =
  /<script\b[^>]*\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*(?:\/>|>\s*<\/script\s*>)/gi;

export function stripExternalScripts(html: string): {
  html: string;
  stripped: number;
} {
  const matches = html.match(EXTERNAL_SCRIPT_RE);
  return {
    html: html.replace(EXTERNAL_SCRIPT_RE, ''),
    stripped: matches ? matches.length : 0,
  };
}
