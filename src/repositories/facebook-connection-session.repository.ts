import { getServiceSupabase } from '@/lib/supabase';
import { decryptToken, encryptToken } from '@/lib/token-crypto';

type PendingPageInput = {
  id: string;
  name: string;
  access_token: string;
  tasks?: string[];
};

type CreateSessionInput = {
  facebookUserId?: string | null;
  userAccessToken: string;
  pages: PendingPageInput[];
  grantedScopes: string[];
  requiredScopes: string[];
};

type FacebookConnectionSessionRow = {
  id: string;
  facebook_user_id?: string | null;
  user_access_token: string;
  pages_json: Array<{
    id: string;
    name: string;
    access_token: string;
    tasks?: string[];
  }>;
  granted_scopes_json?: string[] | null;
  required_scopes_json?: string[] | null;
  expires_at: string;
};

export type PendingFacebookPage = {
  id: string;
  name: string;
  accessToken: string;
  tasks: string[];
};

export type PendingFacebookConnectionSession = {
  id: string;
  facebookUserId: string | null;
  userAccessToken: string;
  grantedScopes: string[];
  requiredScopes: string[];
  expiresAt: string;
  pages: PendingFacebookPage[];
};

export class FacebookConnectionSessionRepository {
  static async createSession(input: CreateSessionInput) {
    const { data, error } = await getServiceSupabase()
      .from('facebook_connection_sessions')
      .insert({
        facebook_user_id: input.facebookUserId ?? null,
        user_access_token: encryptToken(input.userAccessToken),
        pages_json: input.pages.map((page) => ({
          id: page.id,
          name: page.name,
          access_token: encryptToken(page.access_token),
          tasks: page.tasks ?? [],
        })),
        granted_scopes_json: input.grantedScopes,
        required_scopes_json: input.requiredScopes,
      })
      .select('id')
      .single();

    if (error || !data?.id) {
      console.error('Error creating Facebook connection session:', error);
      return null;
    }

    return data.id as string;
  }

  static async getSession(sessionId: string): Promise<PendingFacebookConnectionSession | null> {
    const { data, error } = await getServiceSupabase()
      .from('facebook_connection_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.error('Error fetching Facebook connection session:', error);
      }
      return null;
    }

    const row = data as FacebookConnectionSessionRow;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await this.deleteSession(sessionId);
      return null;
    }

    return {
      id: row.id,
      facebookUserId: row.facebook_user_id ?? null,
      userAccessToken: decryptToken(row.user_access_token) ?? '',
      grantedScopes: row.granted_scopes_json ?? [],
      requiredScopes: row.required_scopes_json ?? [],
      expiresAt: row.expires_at,
      pages: (row.pages_json ?? []).map((page) => ({
        id: page.id,
        name: page.name,
        accessToken: decryptToken(page.access_token) ?? '',
        tasks: page.tasks ?? [],
      })),
    };
  }

  static async deleteSession(sessionId: string) {
    const { error } = await getServiceSupabase()
      .from('facebook_connection_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error('Error deleting Facebook connection session:', error);
      return false;
    }

    return true;
  }

  static async consumeSession(sessionId: string) {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    await this.deleteSession(sessionId);
    return session;
  }
}
