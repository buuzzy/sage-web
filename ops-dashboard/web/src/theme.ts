/**
 * Chart color tokens — read from CSS variables so light/dark swap in one place.
 * The categorical palette here was validated against
 * dataviz/scripts/validate_palette.js (blue + orange, light + dark surfaces).
 */
import { useEffect, useState } from 'react';

export interface ChartTokens {
  series1: string;
  series2: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  axisLine: string;
  splitLine: string;
  surface: string;
}

function readVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function readTokens(): ChartTokens {
  return {
    series1: readVar('--series-1', '#3987e5'),
    series2: readVar('--series-2', '#d95926'),
    textPrimary: readVar('--ink-primary', '#ffffff'),
    textSecondary: readVar('--ink-secondary', '#c3c2b7'),
    textMuted: readVar('--ink-muted', '#898781'),
    axisLine: readVar('--border-strong', 'rgba(255,255,255,0.18)'),
    splitLine: readVar('--border', 'rgba(255,255,255,0.10)'),
    surface: readVar('--surface-card', '#1a1a19'),
  };
}

export function useChartTokens(): ChartTokens {
  const [t, setT] = useState<ChartTokens>(readTokens);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const update = () => setT(readTokens());
    mq.addEventListener('change', update);
    // Also re-read on a microtask so first paint after StrictMode double-mount
    // picks up the final resolved values from getComputedStyle.
    queueMicrotask(update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return t;
}