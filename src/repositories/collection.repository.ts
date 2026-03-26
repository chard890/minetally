import { appendFileSync } from 'node:fs';
import { getServiceSupabase } from '@/lib/supabase';
import { getSyncDiagnosticsLogPath } from '@/lib/sync-diagnostics';
import { FacebookPageRepository } from '@/repositories/facebook-page.repository';
import { BatchSyncStatus, ClaimWord, CollectionListItem, CollectionStatus, CollectionWorkflowDetail, ItemStatus, ItemWorkflowDetail, PriceReviewStatus } from '@/types';

type CollectionListRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  finalize_date?: string;
  status: CollectionStatus;
  total_batch_posts?: number;
  total_items?: number;
  total_claimed_items?: number;
  total_needs_review?: number;
  total_value?: number | string | null;
  facebook_pages?: {
    page_name?: string;
  } | null;
};

type CollectionDetailCommentRow = {
  id: string;
  commenter_id: string;
  commenter_name: string;
  comment_text: string;
  commented_at: string;
  normalized_text: string;
  is_valid_claim: boolean;
  is_cancel_comment: boolean;
  is_late_claim?: boolean;
  is_first_claimant?: boolean;
};

type CollectionDetailWinnerRow = {
  buyer_id: string;
  buyer_name: string;
  resolved_at: string;
  winning_claim_word?: string | null;
  resolved_price?: number | string | null;
  is_manual_override?: boolean;
};

type CollectionDetailItemRow = {
  id: string;
  item_number: number;
  title?: string;
  image_url: string;
  thumbnail_url: string;
  meta_media_id: string;
  size_label?: string | null;
  status: ItemStatus;
  price_review_status?: string;
  claim_status?: string;
  raw_price_text: string;
  price_map?: Record<string, unknown> | null;
  needs_price_review?: boolean;
  comments?: CollectionDetailCommentRow[];
  item_winners?: CollectionDetailWinnerRow[];
};

type CollectionDetailBatchRow = {
  id: string;
  collection_id?: string;
  title: string;
  posted_at: string;
  meta_post_id?: string | null;
  sync_status: string;
  sync_note?: string;
  last_synced_at?: string;
  sync_error?: string | null;
  total_items?: number;
  total_claimed_items?: number;
  total_needs_review?: number;
  items?: CollectionDetailItemRow[];
};

type FlatItemRow = CollectionDetailItemRow & {
  batch_post_id: string;
};

type FlatCommentRow = CollectionDetailCommentRow & {
  item_id: string;
};

type FlatWinnerRow = CollectionDetailWinnerRow & {
  item_id: string;
};

type CollectionDetailRow = CollectionListRow & {
  manual_overrides_count?: number;
  cancel_items_count?: number;
  last_synced_at?: string;
  sync_error?: string | null;
  batch_posts?: CollectionDetailBatchRow[];
};

type ItemStatusRow = {
  status: ItemStatus;
};

type WinnerMetricsRow = {
  resolved_price?: number | string | null;
  buyer_name?: string | null;
  needs_review?: boolean | null;
  items?: { status?: ItemStatus | null } | Array<{ status?: ItemStatus | null }> | null;
};

function getWinnerItemStatus(row: WinnerMetricsRow): ItemStatus | null {
  if (Array.isArray(row.items)) {
    return row.items[0]?.status ?? null;
  }

  return row.items?.status ?? null;
}

function normalizeBatchSyncStatus(status?: string): BatchSyncStatus {
  switch (status) {
    case 'synced':
      return 'synced';
    case 'syncing':
      return 'syncing';
    case 'error':
      return 'attention';
    default:
      return 'pending';
  }
}

function normalizePriceReviewStatus(status?: string | null, needsPriceReview?: boolean | null): PriceReviewStatus {
  if (needsPriceReview) {
    return 'needs_review';
  }

  switch (status) {
    case 'manual_override':
    case 'locked':
    case 'needs_review':
      return status;
    default:
      return 'ready';
  }
}

function normalizeClaimWord(claimWord?: string | null): ClaimWord | null {
  switch (claimWord) {
    case 'mine':
    case 'grab':
    case 'steal':
    case 'm':
    case 'g':
    case 's':
      return claimWord;
    default:
      return null;
  }
}

function deriveItemStatus(item: CollectionDetailItemRow): ItemStatus {
  const winner = item.item_winners?.[0];

  if (item.status === 'locked') {
    return 'locked';
  }

  if (winner?.is_manual_override || item.status === 'manual_override') {
    return 'manual_override';
  }

  if (item.status === 'needs_review') {
    return 'needs_review';
  }

  if (winner) {
    return 'claimed';
  }

  return item.status;
}

function mapItemDetailRow(
  item: CollectionDetailItemRow,
  batch: Pick<CollectionDetailBatchRow, 'id' | 'title' | 'meta_post_id'>,
): ItemWorkflowDetail {
  const effectiveStatus = deriveItemStatus(item);

  return {
    id: item.id,
    itemNumber: item.item_number,
    title: item.title || `Item #${item.item_number}`,
    imageUrl: item.image_url,
    thumbnailUrl: item.thumbnail_url,
    photoId: item.meta_media_id,
    sizeLabel: item.size_label ?? undefined,
    status: effectiveStatus,
    sourceBatchPostId: batch.id,
    sourceBatchTitle: batch.title,
    sourcePostUrl: batch.meta_post_id ? `https://facebook.com/${batch.meta_post_id}` : '',
    priceReviewStatus: normalizePriceReviewStatus(item.price_review_status, item.needs_price_review),
    claimStatus: item.claim_status ?? effectiveStatus,
    rawPriceText: item.raw_price_text,
    priceMap: item.price_map || {},
    needsPriceReview:
      item.needs_price_review ?? normalizePriceReviewStatus(item.price_review_status, item.needs_price_review) === 'needs_review',
    winner: item.item_winners?.[0]
      ? {
          buyerId: item.item_winners[0].buyer_id,
          buyerName: item.item_winners[0].buyer_name,
          timestamp: item.item_winners[0].resolved_at,
          claimWord: normalizeClaimWord(item.item_winners[0].winning_claim_word) || 'mine',
          source: item.item_winners[0].is_manual_override ? 'manual' as const : 'auto' as const,
        }
      : null,
    winningClaimWord: normalizeClaimWord(item.item_winners?.[0]?.winning_claim_word) || null,
    resolvedPrice:
      item.item_winners?.[0] && item.item_winners[0].resolved_price !== null
        ? Number(item.item_winners[0].resolved_price)
        : null,
    commentCount: item.comments?.length || 0,
    hasManualOverride: !!item.item_winners?.[0]?.is_manual_override || effectiveStatus === 'manual_override',
    cancelCount: (item.comments || []).filter((comment) => comment.is_cancel_comment).length,
    comments: (item.comments || []).map((comment) => ({
      id: comment.id,
      buyerId: comment.commenter_id,
      buyerName: comment.commenter_name,
      message: comment.comment_text,
      timestamp: comment.commented_at,
      normalizedText: comment.normalized_text,
      isValidClaim: comment.is_valid_claim,
      isCancelComment: comment.is_cancel_comment,
      tags: [
        ...(comment.is_valid_claim ? ['valid claim'] as const : []),
        ...(comment.is_first_claimant ? ['first claimant'] as const : []),
        ...(comment.is_late_claim ? ['late claim'] as const : []),
        ...(comment.is_cancel_comment ? ['cancel comment'] as const : []),
      ],
    })),
  };
}

export class CollectionRepository {
  private static async getOwnedPageIds() {
    return await FacebookPageRepository.listOwnedPageIds();
  }

  static async listCollections(): Promise<CollectionListItem[]> {
    const ownedPageIds = await this.getOwnedPageIds();
    if (ownedPageIds.length === 0) {
      return [];
    }

    const { data, error } = await getServiceSupabase()
      .from('collections')
      .select(`
        *,
        facebook_pages!inner (
          page_name
        )
      `)
      .in('page_id', ownedPageIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listing collections:', error);
      return [];
    }

    return (data as CollectionListRow[]).map((col) => ({
      id: col.id,
      name: col.name,
      startDate: col.start_date,
      endDate: col.end_date,
      finalizeDate: col.finalize_date,
      status: col.status,
      connectedFacebookPage: col.facebook_pages?.page_name || 'Disconnected',
      totalBatchPosts: col.total_batch_posts || 0,
      totalItemPhotos: col.total_items || 0,
      totalClaimedItems: col.total_claimed_items || 0,
      needsReviewCount: col.total_needs_review || 0,
      totalCollectionValue: Number(col.total_value ?? 0),
    }));
  }

  static async getCollectionById(id: string) {
    const ownedPageIds = await this.getOwnedPageIds();
    if (ownedPageIds.length === 0) {
      return null;
    }

    const { data, error } = await getServiceSupabase()
      .from('collections')
      .select('*')
      .eq('id', id)
      .in('page_id', ownedPageIds)
      .maybeSingle();
      
    if (error) return null;
    return data;
  }

  static async getCollectionDetail(id: string): Promise<CollectionWorkflowDetail | null> {
    const ownedPageIds = await this.getOwnedPageIds();
    if (ownedPageIds.length === 0) {
      return null;
    }

    const { data, error } = await getServiceSupabase()
      .from('collections')
      .select(`
        *,
        facebook_pages!inner (
          page_name
        )
      `)
      .eq('id', id)
      .in('page_id', ownedPageIds)
      .maybeSingle();

    if (error) {
      console.error('Error fetching collection detail:', error);
      return null;
    }

    if (!data) return null;
    const detail = data as CollectionDetailRow;

    const { data: batchData, error: batchError } = await getServiceSupabase()
      .from('batch_posts')
      .select('*')
      .eq('collection_id', id)
      .order('posted_at', { ascending: false });

    if (batchError) {
      console.error('Error fetching collection batches:', batchError);
      return null;
    }

    const batchRows = (batchData ?? []) as CollectionDetailBatchRow[];
    const batchIds = batchRows.map((batch) => batch.id);

    const itemRows: FlatItemRow[] = [];
    const commentRows: FlatCommentRow[] = [];
    const winnerRows: FlatWinnerRow[] = [];

    if (batchIds.length > 0) {
      const { data: itemData, error: itemError } = await getServiceSupabase()
        .from('items')
        .select('*')
        .in('batch_post_id', batchIds)
        .order('item_number', { ascending: true });

      if (itemError) {
        console.error('Error fetching collection items:', itemError);
        return null;
      }

      itemRows.push(...((itemData ?? []) as FlatItemRow[]));
      const itemIds = itemRows.map((item) => item.id);

      if (itemIds.length > 0) {
        const [{ data: commentsData, error: commentsError }, { data: winnersData, error: winnersError }] = await Promise.all([
          getServiceSupabase()
            .from('comments')
            .select('*')
            .in('item_id', itemIds)
            .order('commented_at', { ascending: true }),
          getServiceSupabase()
            .from('item_winners')
            .select('*')
            .in('item_id', itemIds)
            .order('resolved_at', { ascending: false }),
        ]);

        if (commentsError) {
          console.error('Error fetching collection comments:', commentsError);
          return null;
        }

        if (winnersError) {
          console.error('Error fetching collection winners:', winnersError);
          return null;
        }

        commentRows.push(...((commentsData ?? []) as FlatCommentRow[]));
        winnerRows.push(...((winnersData ?? []) as FlatWinnerRow[]));
      }
    }

    const commentsByItemId = new Map<string, FlatCommentRow[]>();
    for (const comment of commentRows) {
      const current = commentsByItemId.get(comment.item_id) ?? [];
      current.push(comment);
      commentsByItemId.set(comment.item_id, current);
    }

    const winnersByItemId = new Map<string, FlatWinnerRow[]>();
    for (const winner of winnerRows) {
      const current = winnersByItemId.get(winner.item_id) ?? [];
      current.push(winner);
      winnersByItemId.set(winner.item_id, current);
    }

    const itemsByBatchId = new Map<string, CollectionDetailItemRow[]>();
    for (const item of itemRows) {
      const current = itemsByBatchId.get(item.batch_post_id) ?? [];
      current.push({
        ...item,
        comments: commentsByItemId.get(item.id) ?? [],
        item_winners: winnersByItemId.get(item.id) ?? [],
      });
      itemsByBatchId.set(item.batch_post_id, current);
    }

    // Mapping logic to reconstruct the detailed object
    const batches = batchRows.map((batch) => {
      const batchItems = itemsByBatchId.get(batch.id) ?? [];
      const items = batchItems.map((item) => mapItemDetailRow(item, batch));

      const claimedItems = items.filter((item) =>
        item.status === 'claimed' || item.status === 'manual_override' || item.status === 'locked'
      ).length;
      const needsReviewCount = items.filter((item) => item.status === 'needs_review').length;

      return {
        id: batch.id,
        title: batch.title,
        postedAt: batch.posted_at,
        syncStatus: normalizeBatchSyncStatus(batch.sync_status),
        syncNote: batch.sync_note || '',
        last_synced_at: batch.last_synced_at,
        sync_error: batch.sync_error,
        itemPhotos: items.length || batch.total_items || 0,
        claimedItems,
        needsReviewCount,
        items,
      };
    });

    const totalClaimedItems = batches.reduce((sum, batch) => sum + batch.claimedItems, 0);
    const totalNeedsReview = batches.reduce((sum, batch) => sum + batch.needsReviewCount, 0);
    const totalItemPhotos = batches.reduce((sum, batch) => sum + batch.itemPhotos, 0);

    return {
      id: detail.id,
      name: detail.name,
      startDate: detail.start_date,
      endDate: detail.end_date,
      finalizeDate: detail.finalize_date,
      status: detail.status,
      connectedFacebookPage: detail.facebook_pages?.page_name || 'Disconnected',
      totalBatchPosts: detail.total_batch_posts || 0,
      totalItemPhotos,
      totalClaimedItems,
      needsReviewCount: totalNeedsReview,
      totalCollectionValue: Number(detail.total_value ?? 0),
      manualOverridesCount: detail.manual_overrides_count || 0,
      cancelItemsCount: detail.cancel_items_count || 0,
      last_synced_at: detail.last_synced_at,
      sync_error: detail.sync_error,
      batches
    };
  }

  static async getItemDetail(collectionId: string, itemId: string): Promise<ItemWorkflowDetail | null> {
    const collection = await this.getCollectionById(collectionId);
    if (!collection) {
      return null;
    }

    const { data, error } = await getServiceSupabase()
      .from('items')
      .select(`
        *,
        comments (*),
        item_winners (*),
        batch_posts!inner (
          id,
          title,
          meta_post_id,
          collection_id
        )
      `)
      .eq('id', itemId)
      .eq('batch_posts.collection_id', collectionId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching item detail:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    const batch = Array.isArray(data.batch_posts) ? data.batch_posts[0] : data.batch_posts;
    if (!batch) {
      return null;
    }

    return mapItemDetailRow(data as CollectionDetailItemRow, batch as Pick<CollectionDetailBatchRow, 'id' | 'title' | 'meta_post_id'>);
  }

  static async createCollection(collection: Partial<CollectionWorkflowDetail> & { page_id?: string }): Promise<{ id?: string, error?: string }> {
    const ownedPageIds = await this.getOwnedPageIds();
    if (!collection.page_id || !ownedPageIds.includes(collection.page_id)) {
      return { error: 'You do not have access to that Facebook Page.' };
    }

    const { data, error } = await getServiceSupabase()
      .from('collections')
      .insert({
          name: collection.name,
          start_date: collection.startDate,
          end_date: collection.endDate,
          status: collection.status || 'open',
          page_id: collection.page_id,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating collection:', error);
      return { error: error.message };
    }

    return { id: data.id };
  }

  static async updateCollectionStatus(id: string, status: string, finalizeDate?: string): Promise<boolean> {
    const ownedPageIds = await this.getOwnedPageIds();
    if (ownedPageIds.length === 0) {
      return false;
    }

    const { error } = await getServiceSupabase()
      .from('collections')
      .update({ 
          status,
          finalize_date: finalizeDate || null
      })
      .eq('id', id)
      .in('page_id', ownedPageIds);

    if (error) {
      console.error('Error updating collection status:', error);
      return false;
    }

    return true;
  }

  static async updateCollectionMetrics(id: string, metrics: { 
    totalClaimed?: number, 
    totalValue?: number, 
    totalReview?: number,
    totalBatchPosts?: number,
    totalItems?: number,
    last_synced_at?: string,
    sync_error?: string | null
  }): Promise<boolean> {
    const ownedPageIds = await this.getOwnedPageIds();
    if (ownedPageIds.length === 0) {
      return false;
    }

    const { error } = await getServiceSupabase()
      .from('collections')
      .update({ 
          total_claimed_items: metrics.totalClaimed,
          total_value: metrics.totalValue,
          total_needs_review: metrics.totalReview,
          total_batch_posts: metrics.totalBatchPosts,
          total_items: metrics.totalItems,
          last_synced_at: metrics.last_synced_at,
          sync_error: metrics.sync_error
      })
      .eq('id', id)
      .in('page_id', ownedPageIds);

    if (error) {
      console.error('Error updating collection metrics:', error);
      return false;
    }

    return true;
  }

  static async recalculateCollectionMetrics(collectionId: string) {
    const logPath = getSyncDiagnosticsLogPath();
    const collection = await this.getCollectionById(collectionId);
    if (!collection) {
      appendFileSync(logPath, `[RECOUNT] Collection ${collectionId} is not accessible to the current Facebook account.\n`);
      return false;
    }

    // 1. Count items by status
    const { data: statusCounts, error: statusError } = await getServiceSupabase()
      .from('items')
      .select('status')
      .eq('collection_id', collectionId);

    if (statusError || !statusCounts) {
      appendFileSync(logPath, `[RECOUNT] Error fetching item statuses: ${statusError?.message}\n`);
      return false;
    }

    const totalItems = statusCounts.length;
    const totalReview = (statusCounts as ItemStatusRow[]).filter((item) => item.status === 'needs_review').length;
    
    const totalClaimed = (statusCounts as ItemStatusRow[]).filter((item) =>
      item.status === 'claimed' || item.status === 'manual_override' || item.status === 'locked'
    ).length;

    // 2. Sum resolved prices for trusted claimed items
    const { data: winners, error: winnersError } = await getServiceSupabase()
      .from('item_winners')
      .select('resolved_price, buyer_name, needs_review, items!inner(collection_id,status)')
      .eq('items.collection_id', collectionId);

    if (winnersError || !winners) {
        appendFileSync(logPath, `[RECOUNT] Error fetching winners: ${winnersError?.message}\n`);
        return false;
    }

    const totalValue = (winners as WinnerMetricsRow[]).reduce((sum, winner) => {
      const itemStatus = getWinnerItemStatus(winner);
      if (!itemStatus || !['claimed', 'manual_override', 'locked'].includes(itemStatus)) {
        return sum;
      }

      if (!winner.buyer_name || String(winner.buyer_name).toLowerCase() === 'unknown commenter') {
        return sum;
      }

      if ('needs_review' in winner && winner.needs_review) {
        return sum;
      }

      return sum + Number(winner.resolved_price || 0);
    }, 0);

    appendFileSync(logPath, `[RECOUNT] Collection ${collectionId}: Items: ${totalItems}, Claimed: ${totalClaimed}, Value: ${totalValue}, Review: ${totalReview}\n`);

    // Update the collection record
    return await this.updateCollectionMetrics(collectionId, {
      totalItems,
      totalClaimed,
      totalValue,
      totalReview,
      last_synced_at: new Date().toISOString()
    });
  }

  static async deleteCollection(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const ownedPageIds = await this.getOwnedPageIds();
      if (ownedPageIds.length === 0) {
        return { success: false, error: 'No connected Facebook pages are available for this account.' };
      }

      const { error } = await getServiceSupabase()
        .from('collections')
        .delete()
        .eq('id', id)
        .in('page_id', ownedPageIds);

      if (error) {
        console.error('Error deleting collection:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Unexpected error deleting collection:', error);
      return { success: false, error: message };
    }
  }
}
