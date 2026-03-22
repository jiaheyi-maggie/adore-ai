import type { SupabaseClient } from '@supabase/supabase-js';

/** Hono context variables set by the auth middleware. */
export type AppVariables = {
  userId: string;
  supabase: SupabaseClient;
};
