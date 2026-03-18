import { supabase } from '@/lib/supabase';
import { MetaPage } from '@/types';

type FacebookPageRow = {
  id: string;
  meta_page_id: string;
  page_name: string;
  user_access_token?: string | null;
  page_access_token?: string | null;
  page_tasks_json?: string[] | null;
  token_type_used_for_sync?: string | null;
  token_last_validated_at?: string | null;
  token_status?: string | null;
  connection_status?: string | null;
  last_sync_error?: string | null;
};

type UpsertFacebookPageInput = MetaPage & {
  userAccessToken: string;
  tokenStatus?: string;
  connectionStatus?: string;
  lastSyncError?: string | null;
};

export class FacebookPageRepository {
  static async getConnectedPage(): Promise<MetaPage | null> {
    const { data, error } = await supabase
      .from('facebook_pages')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error fetching connected page:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.meta_page_id,
      name: data.page_name,
      access_token: data.page_access_token,
      user_access_token: data.user_access_token ?? undefined,
      tasks: data.page_tasks_json ?? undefined,
      token_status: data.token_status ?? undefined,
      connection_status: data.connection_status ?? undefined,
      token_last_validated_at: data.token_last_validated_at ?? undefined,
      token_type_used_for_sync: data.token_type_used_for_sync ?? undefined,
      last_sync_error: data.last_sync_error ?? null,
    };
  }

  static async getPageById(id: string): Promise<MetaPage | null> {
    const { data, error } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.meta_page_id,
      name: data.page_name,
      access_token: data.page_access_token,
      user_access_token: data.user_access_token ?? undefined,
      tasks: data.page_tasks_json ?? undefined,
      token_status: data.token_status ?? undefined,
      connection_status: data.connection_status ?? undefined,
      token_last_validated_at: data.token_last_validated_at ?? undefined,
      token_type_used_for_sync: data.token_type_used_for_sync ?? undefined,
      last_sync_error: data.last_sync_error ?? null,
    };
  }

  static async listPages(): Promise<{ id: string, name: string }[]> {
    const { data, error } = await supabase
      .from('facebook_pages')
      .select('id, page_name')
      .order('page_name');

    if (error) {
      console.error('Error listing Facebook pages:', error);
      return [];
    }

    return ((data || []) as FacebookPageRow[]).map((page) => ({
      id: page.id,
      name: page.page_name
    }));
  }

  static async upsertPage(page: UpsertFacebookPageInput, expiresAt?: string): Promise<boolean> {
    const { error } = await supabase
      .from('facebook_pages')
      .upsert({
        meta_page_id: page.id,
        page_name: page.name,
        user_access_token: page.userAccessToken,
        page_access_token: page.access_token,
        page_tasks_json: page.tasks ?? [],
        token_type_used_for_sync: 'page_access_token',
        token_last_validated_at: new Date().toISOString(),
        token_status: page.tokenStatus ?? 'valid',
        connection_status: page.connectionStatus ?? 'active',
        last_sync_error: page.lastSyncError ?? null,
        token_expires_at: expiresAt,
        connected_at: new Date().toISOString()
      }, { onConflict: 'meta_page_id' });

    if (error) {
      console.error('Error upserting Facebook page:', error);
      return false;
    }
    return true;
  }

  static async disconnectPage(): Promise<boolean> {
    const { error } = await supabase
      .from('facebook_pages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      console.error('Error disconnecting Facebook page:', error);
      return false;
    }
    return true;
  }

  static async markPageTokenStatus(params: {
    pageId: string;
    tokenStatus: string;
    connectionStatus: string;
    lastSyncError?: string | null;
  }): Promise<boolean> {
    const { error } = await supabase
      .from('facebook_pages')
      .update({
        token_status: params.tokenStatus,
        connection_status: params.connectionStatus,
        last_sync_error: params.lastSyncError ?? null,
        token_last_validated_at: new Date().toISOString(),
      })
      .eq('meta_page_id', params.pageId);

    if (error) {
      console.error('Error updating Facebook page token status:', error);
      return false;
    }

    return true;
  }

  static async markSyncSuccess(pageId: string): Promise<boolean> {
    return this.markPageTokenStatus({
      pageId,
      tokenStatus: 'valid',
      connectionStatus: 'active',
      lastSyncError: null,
    });
  }
}
