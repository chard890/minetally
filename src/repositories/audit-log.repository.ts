import { supabase } from '@/lib/supabase';

type AuditLogInput = {
  collectionId?: string;
  batchPostId?: string;
  itemId?: string;
  action: string;
  actor?: string;
  reason?: string;
  details?: unknown;
};

export class AuditLogRepository {
  static async log(log: AuditLogInput) {
    const { error } = await supabase.from('audit_logs').insert({
      collection_id: log.collectionId,
      batch_post_id: log.batchPostId,
      item_id: log.itemId,
      action: log.action,
      actor: log.actor || 'system',
      reason: log.reason,
      details_json: log.details || {},
    });

    if (error) {
      console.error('Error creating audit log:', error);
      return false;
    }
    return true;
  }

  static async listByCollection(collectionId: string) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('collection_id', collectionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listing audit logs:', error);
      return [];
    }
    return data;
  }
}
