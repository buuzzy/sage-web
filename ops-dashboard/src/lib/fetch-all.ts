/**
 * Paginated row fetcher that works around hosted Supabase's 1000-row
 * PostgREST cap (db-max-rows). Callers supply a query builder that takes
 * an offset and returns a fresh supabase query; we loop .range() until a
 * short page.
 *
 * IMPORTANT: supabase-js query builders are single-use — they cannot be
 * awaited twice. The `fetchPage` callback MUST return a freshly built
 * query each invocation (we call it once per page).
 */
export interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function fetchAll<T>(
  fetchPage: (offset: number) => Promise<PageResult<T>>,
  options: { maxPages?: number } = {},
): Promise<T[]> {
  const PAGE = 1000;
  const maxPages = options.maxPages ?? 50;
  const out: T[] = [];
  for (let i = 0; i < maxPages; i++) {
    const offset = i * PAGE;
    const { data, error } = await fetchPage(offset);
    if (error) throw new Error(`fetchAll page ${i} failed: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  if (out.length >= maxPages * PAGE) {
    console.warn(
      `[ops-dashboard] fetchAll hit maxPages=${maxPages} (~${out.length} rows) — results may be truncated`,
    );
  }
  return out;
}