import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

let _adminClient: SupabaseClient | null = null;

/** Admin client — bypasses RLS. Use only for background jobs and service operations. */
export function getAdminClient(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      getEnvOrThrow('SUPABASE_URL'),
      getEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _adminClient;
}

/**
 * Creates a user-scoped Supabase client that respects RLS.
 * The client authenticates as the user whose JWT is provided.
 */
export function createUserClient(accessToken: string): SupabaseClient {
  const supabaseUrl = getEnvOrThrow('SUPABASE_URL');
  const supabaseAnonKey = getEnvOrThrow('SUPABASE_ANON_KEY');

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
