import { createBrowserClient } from '@supabase/ssr';

const globalForSupabase = globalThis as unknown as {
  supabaseClient: ReturnType<typeof createBrowserClient> | undefined;
};

export function createClient() {
  if (!globalForSupabase.supabaseClient) {
    globalForSupabase.supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return globalForSupabase.supabaseClient;
}
