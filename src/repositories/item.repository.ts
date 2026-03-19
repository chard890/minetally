import { appendFileSync } from 'node:fs';
import { getServiceSupabase } from '@/lib/supabase';
import { getSyncDiagnosticsLogPath } from '@/lib/sync-diagnostics';

type ItemUpdate = Record<string, unknown>;
type ItemUpsertInput = {
  collection_id?: string;
  batch_post_id: string;
  item_number: number;
  meta_media_id?: string;
  image_url: string;
  thumbnail_url: string;
  status: string;
  raw_price_text?: string | null;
  raw_media_json?: unknown;
  last_synced_at?: string;
};

export class ItemRepository {
  static async findById(id: string) {
    const { data, error } = await getServiceSupabase()
      .from('items')
      .select(`
        *,
        comments (*),
        item_winners (*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
        console.error('Error finding item:', error);
        return null;
    }
    return data;
  }

  static async updateItem(id: string, updates: ItemUpdate) {
    const { error } = await getServiceSupabase()
      .from('items')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating item:', error);
      return false;
    }
    return true;
  }

  static async setLockStatus(id: string, isLocked: boolean) {
    const { error } = await getServiceSupabase()
      .from('items')
      .update({ is_locked: isLocked, status: isLocked ? 'locked' : 'claimed' })
      .eq('id', id);

    if (error) {
      console.error('Error locking item:', error);
      return false;
    }
    return true;
  }
  static async getItem(id: string) {
    const { data, error } = await getServiceSupabase()
      .from('items')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) return null;
    return data;
  }

  static async upsertItem(item: ItemUpsertInput) {
    const logPath = getSyncDiagnosticsLogPath();
    const { data, error } = await getServiceSupabase()
      .from('items')
      .upsert(item, { onConflict: 'meta_media_id' })
      .select('id')
      .maybeSingle();

    if (error) {
      appendFileSync(logPath, `[ItemRepository] Error upserting item ${item.meta_media_id ?? 'unknown'}: ${error.message}\n`);
      console.error('Error upserting item:', error);
      return null;
    }
    return data?.id || null;
  }
}
