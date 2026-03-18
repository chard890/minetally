import { supabase } from '@/lib/supabase';
import { MetaPage } from '@/types';

type FacebookPageRow = {
  id: string;
  meta_page_id: string;
  page_name: string;
  access_token: string;
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
      access_token: data.access_token
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
      access_token: data.access_token
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

  static async upsertPage(page: MetaPage, expiresAt?: string): Promise<boolean> {
    const { error } = await supabase
      .from('facebook_pages')
      .upsert({
        meta_page_id: page.id,
        page_name: page.name,
        access_token: page.access_token,
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
}
