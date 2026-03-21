import { getServiceSupabase } from '@/lib/supabase';
import { decryptToken, encryptToken } from '@/lib/token-crypto';
import { MetaPage } from '@/types';

type FacebookPageRow = {
  id: string;
  meta_page_id: string;
  page_name: string;
  facebook_user_id?: string | null;
  user_access_token?: string | null;
  page_access_token?: string | null;
  page_tasks_json?: string[] | null;
  token_type_used_for_sync?: string | null;
  token_last_validated_at?: string | null;
  token_status?: string | null;
  connection_status?: string | null;
  reconnect_required?: boolean | null;
  token_expires_at?: string | null;
  last_sync_error?: string | null;
};

type UpsertFacebookPageInput = MetaPage & {
  userAccessToken: string;
  facebookUserId?: string | null;
  tokenStatus?: string;
  connectionStatus?: string;
  reconnectRequired?: boolean;
  lastSyncError?: string | null;
};

export class FacebookPageRepository {
  private static isMissingReconnectRequiredColumn(error: { code?: string; message?: string } | null) {
    return error?.code === '42703' && error.message?.includes('reconnect_required');
  }

  static async getConnectedPage(): Promise<MetaPage | null> {
    let { data, error } = await getServiceSupabase()
      .from('facebook_pages')
      .select('*')
      .eq('connection_status', 'active')
      .eq('reconnect_required', false)
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (this.isMissingReconnectRequiredColumn(error)) {
      ({ data, error } = await getServiceSupabase()
        .from('facebook_pages')
        .select('*')
        .eq('connection_status', 'active')
        .order('connected_at', { ascending: false })
        .limit(1)
        .maybeSingle());
    }

    if (error) {
      console.error('Error fetching connected page:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.meta_page_id,
      name: data.page_name,
      access_token: decryptToken(data.page_access_token) ?? '',
      facebook_user_id: data.facebook_user_id ?? undefined,
      user_access_token: decryptToken(data.user_access_token) ?? undefined,
      tasks: data.page_tasks_json ?? undefined,
      token_status: data.token_status ?? undefined,
      connection_status: data.connection_status ?? undefined,
      token_last_validated_at: data.token_last_validated_at ?? undefined,
      token_type_used_for_sync: data.token_type_used_for_sync ?? undefined,
      reconnect_required: Boolean(data.reconnect_required),
      token_expires_at: data.token_expires_at ?? undefined,
      last_sync_error: data.last_sync_error ?? null,
    };
  }

  static async getPageById(id: string): Promise<MetaPage | null> {
    const { data, error } = await getServiceSupabase()
      .from('facebook_pages')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.meta_page_id,
      name: data.page_name,
      access_token: decryptToken(data.page_access_token) ?? '',
      facebook_user_id: data.facebook_user_id ?? undefined,
      user_access_token: decryptToken(data.user_access_token) ?? undefined,
      tasks: data.page_tasks_json ?? undefined,
      token_status: data.token_status ?? undefined,
      connection_status: data.connection_status ?? undefined,
      token_last_validated_at: data.token_last_validated_at ?? undefined,
      token_type_used_for_sync: data.token_type_used_for_sync ?? undefined,
      reconnect_required: Boolean(data.reconnect_required),
      token_expires_at: data.token_expires_at ?? undefined,
      last_sync_error: data.last_sync_error ?? null,
    };
  }

  static async getPageByMetaPageId(metaPageId: string): Promise<{ id: string; page: MetaPage } | null> {
    const { data, error } = await getServiceSupabase()
      .from('facebook_pages')
      .select('*')
      .eq('meta_page_id', metaPageId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      page: {
        id: data.meta_page_id,
        name: data.page_name,
        access_token: decryptToken(data.page_access_token) ?? '',
        facebook_user_id: data.facebook_user_id ?? undefined,
        user_access_token: decryptToken(data.user_access_token) ?? undefined,
        tasks: data.page_tasks_json ?? undefined,
        token_status: data.token_status ?? undefined,
        connection_status: data.connection_status ?? undefined,
        token_last_validated_at: data.token_last_validated_at ?? undefined,
        token_type_used_for_sync: data.token_type_used_for_sync ?? undefined,
        reconnect_required: Boolean(data.reconnect_required),
        token_expires_at: data.token_expires_at ?? undefined,
        last_sync_error: data.last_sync_error ?? null,
      },
    };
  }

  static async hasPageRecord(id: string): Promise<boolean> {
    const { data, error } = await getServiceSupabase()
      .from('facebook_pages')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error checking Facebook page record:', error);
      return false;
    }

    return Boolean(data);
  }

  static async listPages(): Promise<{ id: string, name: string }[]> {
    let { data, error } = await getServiceSupabase()
      .from('facebook_pages')
      .select('id, page_name')
      .eq('connection_status', 'active')
      .eq('reconnect_required', false)
      .order('page_name');

    if (this.isMissingReconnectRequiredColumn(error)) {
      ({ data, error } = await getServiceSupabase()
        .from('facebook_pages')
        .select('id, page_name')
        .eq('connection_status', 'active')
        .order('page_name'));
    }

    if (error) {
      console.error('Error listing Facebook pages:', error);
      return [];
    }

    return ((data || []) as FacebookPageRow[]).map((page) => ({
      id: page.id,
      name: page.page_name
    }));
  }

  static async listPagesByIds(ids: string[]): Promise<{ id: string, name: string }[]> {
    if (ids.length === 0) {
      return [];
    }

    let { data, error } = await getServiceSupabase()
      .from('facebook_pages')
      .select('id, page_name')
      .in('id', ids)
      .eq('connection_status', 'active')
      .eq('reconnect_required', false)
      .order('page_name');

    if (this.isMissingReconnectRequiredColumn(error)) {
      ({ data, error } = await getServiceSupabase()
        .from('facebook_pages')
        .select('id, page_name')
        .in('id', ids)
        .eq('connection_status', 'active')
        .order('page_name'));
    }

    if (error) {
      console.error('Error listing Facebook pages by ids:', error);
      return [];
    }

    return ((data || []) as FacebookPageRow[]).map((page) => ({
      id: page.id,
      name: page.page_name,
    }));
  }

  static async upsertPage(page: UpsertFacebookPageInput, expiresAt?: string): Promise<boolean> {
    const { error } = await getServiceSupabase()
      .from('facebook_pages')
      .upsert({
        meta_page_id: page.id,
        page_name: page.name,
        facebook_user_id: page.facebookUserId ?? page.facebook_user_id ?? null,
        user_access_token: encryptToken(page.userAccessToken),
        page_access_token: encryptToken(page.access_token),
        page_tasks_json: page.tasks ?? [],
        token_type_used_for_sync: 'page_access_token',
        token_last_validated_at: new Date().toISOString(),
        token_status: page.tokenStatus ?? 'valid',
        connection_status: page.connectionStatus ?? 'active',
        reconnect_required: page.reconnectRequired ?? false,
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
    const { error } = await getServiceSupabase()
      .from('facebook_pages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      console.error('Error disconnecting Facebook page:', error);
      return false;
    }
    return true;
  }

  static async disconnectPageById(id: string): Promise<boolean> {
    const { error } = await getServiceSupabase()
      .from('facebook_pages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error disconnecting Facebook page by id:', error);
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
    const { error } = await getServiceSupabase()
      .from('facebook_pages')
      .update({
        token_status: params.tokenStatus,
        connection_status: params.connectionStatus,
        reconnect_required: params.connectionStatus === 'needs_reconnect' || params.tokenStatus !== 'valid',
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
