import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
type SupabaseClientWithConfig = ReturnType<typeof createClient> & { isConfigured: boolean };

const isValidUrl = (url: string) => {
  try {
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

const createMissingConfigProxy = (name: string): SupabaseClientWithConfig => {
  return new Proxy({}, {
    get: (_, prop) => {
      if (prop === 'isConfigured') return false;
      throw new Error(
        `Supabase ${name} requested but not configured. ` +
        `Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.`
      );
    },
  }) as unknown as SupabaseClientWithConfig;
};

export const supabase = (isValidUrl(supabaseUrl) && supabaseAnonKey && supabaseAnonKey !== 'your-supabase-anon-key')
  ? Object.assign(createClient(supabaseUrl, supabaseAnonKey), { isConfigured: true })
  : createMissingConfigProxy('client');

/**
 * Service role client for bypass RLS in server actions/scripts.
 */
export const getServiceSupabase = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!isValidUrl(supabaseUrl) || !serviceKey || serviceKey === 'your-supabase-service-role-key') {
    return createMissingConfigProxy('service-client');
  }
  return Object.assign(createClient(supabaseUrl, serviceKey), { isConfigured: true });
};

export const isSupabaseConfigured = () => {
  try {
    return supabase.isConfigured;
  } catch {
    return false;
  }
};
