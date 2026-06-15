import { createClient } from '@supabase/supabase-js';

/**
 * SERVER-ONLY Supabase client using the service_role key.
 * It BYPASSES Row Level Security, so it must NEVER be imported into a client
 * component / browser bundle. Only import this from Route Handlers (`route.ts`).
 *
 * The service key is read from a non-public env var, so it is never shipped to
 * the browser even if this module is accidentally referenced.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createAdminClient() {
  if (!url || !serviceKey) {
    throw new Error('Supabase admin client misconfigured: missing URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
