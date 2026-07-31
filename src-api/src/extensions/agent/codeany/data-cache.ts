/**
 * Structured data cache for minishare MCP tool outputs.
 *
 * When a minishare tool (daily, daily_basic, fina_indicator, etc.) returns
 * tabular text data, the PostToolUse hook parses it into a ParsedDataset and
 * caches it with a unique key. The LLM then calls `render_chart` with that
 * key, and the server generates ECharts HTML from the cached data — bypassing
 * the error-prone step of the LLM manually transcribing hundreds of numbers.
 */

import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('DataCache');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedDataset {
  /** Ordered column names as they appear in the source text. */
  columns: string[];
  /** Each row is a map of column-name -> raw string value. */
  rows: Record<string, string>[];
  /** Source tool name (e.g. "daily", "daily_basic"). */
  source: string;
}

interface CacheEntry {
  data: ParsedDataset;
  ts: number;
}

// ---------------------------------------------------------------------------
// Cache (module-level singleton, per process)
// ---------------------------------------------------------------------------

const cache = new Map<string, CacheEntry>();
let counter = 0;

const MAX_ENTRIES = 200;
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function evictExpired(): void {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.ts > TTL_MS) cache.delete(k);
  }
}

/**
 * Parse minishare tool text output into a structured dataset, cache it, and
 * return the cache key. Returns null if parsing yields no data rows.
 */
export function parseAndCache(rawText: string, source: string): string | null {
  const dataset = parseToolOutput(rawText, source);
  if (!dataset || dataset.rows.length === 0) return null;

  counter++;
  const key = `${source}_${counter}`;
  cache.set(key, { data: dataset, ts: Date.now() });

  if (cache.size > MAX_ENTRIES) evictExpired();

  logger.info(
    `[parseAndCache] cached ${key}: ${dataset.rows.length} rows, ${dataset.columns.length} cols`
  );
  return key;
}

/**
 * Retrieve a cached dataset by key. Returns undefined if expired or missing.
 */
export function getCachedData(key: string): ParsedDataset | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse minishare tool text output into a ParsedDataset.
 *
 * Handles the consistent `key:value | key:value` format used by all tools in
 * the tushare MCP server. Both `key:value` and `key: value` are supported.
 */
export function parseToolOutput(text: string, source: string): ParsedDataset | null {
  const lines = text.split('\n');
  const rows: Record<string, string>[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('---')) continue;
    if (trimmed.startsWith('...')) continue;
    if (!trimmed.includes(':')) continue;

    const segments = trimmed.split(/\s*\|\s*/);
    const row: Record<string, string> = {};

    for (const seg of segments) {
      const colonIdx = seg.indexOf(':');
      if (colonIdx === -1) continue;
      const key = seg.slice(0, colonIdx).trim();
      const value = seg.slice(colonIdx + 1).trim();
      if (key && value) row[key] = value;
    }

    if (Object.keys(row).length > 0) rows.push(row);
  }

  if (rows.length === 0) return null;

  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }

  return { columns, rows, source };
}

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

/**
 * Extract the first numeric value from a string that may contain trailing
 * units. Returns null if no number is found.
 *
 * "30.91" -> 30.91, "2956154.83手" -> 2956154.83, "-2.98%" -> -2.98
 */
export function parseNum(val: string | undefined): number | null {
  if (!val) return null;
  const m = val.match(/-?[\d,]+\.?\d*/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

/**
 * Find the first column name in a dataset matching any candidate (case-insensitive).
 */
export function findCol(data: ParsedDataset, candidates: string[]): string | undefined {
  for (const c of candidates) {
    const found = data.columns.find(
      (col) => col === c || col.toLowerCase() === c.toLowerCase()
    );
    if (found) return found;
  }
  return undefined;
}
