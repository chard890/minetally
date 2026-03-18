import { getServiceSupabase } from '@/lib/supabase';

type CommentInsertInput = {
  itemId?: string;
  item_id?: string;
  id?: string;
  meta_comment_id?: string;
  commenterId?: string | null;
  commenter_id?: string | null;
  commenterName?: string;
  commenter_name?: string;
  commentText?: string;
  comment_text?: string;
  normalizedText?: string | null;
  normalized_text?: string | null;
  claimType?: string | null;
  claim_type?: string | null;
  isValidClaim?: boolean | null;
  is_valid_claim?: boolean | null;
  isCancelComment?: boolean | null;
  is_cancel_comment?: boolean | null;
  isLateClaim?: boolean | null;
  is_late_claim?: boolean | null;
  isFirstClaimant?: boolean | null;
  is_first_claimant?: boolean | null;
  commentedAt?: string;
  commented_at?: string;
};

export class CommentRepository {
  static async insertMany(comments: CommentInsertInput[]) {
    const { error } = await getServiceSupabase().from('comments').insert(
      comments.map(c => ({
        item_id: c.itemId ?? c.item_id,
        meta_comment_id: c.id ?? c.meta_comment_id,
        commenter_id: c.commenterId ?? c.commenter_id ?? null,
        commenter_name: c.commenterName ?? c.commenter_name,
        comment_text: c.commentText ?? c.comment_text,
        normalized_text: c.normalizedText ?? c.normalized_text,
        claim_type: c.claimType ?? c.claim_type,
        is_valid_claim: c.isValidClaim ?? c.is_valid_claim,
        is_cancel_comment: c.isCancelComment ?? c.is_cancel_comment,
        is_late_claim: c.isLateClaim ?? c.is_late_claim,
        is_first_claimant: c.isFirstClaimant ?? c.is_first_claimant,
        commented_at: c.commentedAt ?? c.commented_at,
      }))
    );

    if (error) {
      console.error('Error inserting comments:', error);
      return false;
    }
    return true;
  }

  static async listByItem(itemId: string) {
    const { data, error } = await getServiceSupabase()
      .from('comments')
      .select('*')
      .eq('item_id', itemId)
      .order('commented_at', { ascending: true });

    if (error) {
      console.error('Error listing comments:', error);
      return [];
    }
    return data;
  }
}
