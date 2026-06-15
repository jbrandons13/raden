import { supabase } from './supabase';

/**
 * Fetch ALL rows from a table, paginating past PostgREST's default 1000-row
 * cap. Used by Excel exports, which must include every matching row — not just
 * the page currently shown on screen.
 *
 * `modify` lets the caller add ordering / filters, e.g.
 *   fetchAllRows('orders', '*', (q) => q.eq('channel', 'agent').order('order_date'))
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  table: string,
  select = '*',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modify?: (query: any) => any,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase.from(table).select(select);
    if (modify) query = modify(query);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}
