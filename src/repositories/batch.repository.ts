import { getServiceSupabase } from '@/lib/supabase';

type BatchUpsertInput = {
  collection_id: string;
  meta_post_id?: string;
  title: string;
  caption?: string;
  posted_at?: string;
  sync_status?: string;
  last_synced_at?: string;
};

export class BatchRepository {
  static async listByCollection(collectionId: string) {
    const { data, error } = await getServiceSupabase()
      .from('batch_posts')
      .select('*')
      .eq('collection_id', collectionId)
      .order('posted_at', { ascending: false });

    if (error) {
      console.error('Error listing batches:', error);
      return [];
    }
    return data;
  }

  static async updateSyncStatus(id: string, status: string) {
    const { error } = await getServiceSupabase()
      .from('batch_posts')
      .update({ sync_status: status })
      .eq('id', id);

    if (error) {
      console.error('Error updating batch sync status:', error);
      return false;
    }
    return true;
  }

  static async updateCounters(id: string, counters: { total_items: number, total_claimed: number, total_review: number }) {
    const { error } = await getServiceSupabase()
      .from('batch_posts')
      .update({
        total_items: counters.total_items,
        total_claimed_items: counters.total_claimed,
        total_needs_review: counters.total_review
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating batch counters:', error);
      return false;
    }
    return true;
  }

  static async getBatch(id: string) {
    const { data, error } = await getServiceSupabase()
      .from('batch_posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) return null;
    return data;
  }

  static async upsertBatch(batch: BatchUpsertInput) {
    const { data, error } = await getServiceSupabase()
      .from('batch_posts')
      .upsert(batch, { onConflict: 'meta_post_id' })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Error upserting batch:', error);
      return null;
    }
    return data?.id || null;
  }

  static async updateBatchSyncMetadata(id: string, metadata: { last_synced_at?: string, sync_error?: string | null }) {
    const { error } = await getServiceSupabase()
      .from('batch_posts')
      .update(metadata)
      .eq('id', id);

    if (error) {
      console.error('Error updating batch sync metadata:', error);
      return false;
    }
    return true;
  }
}
