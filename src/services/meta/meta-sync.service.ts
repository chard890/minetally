import { MetaPostService, MetaMediaService, MetaCommentService } from './meta-graph.service';
import { FacebookPageRepository } from '@/repositories/facebook-page.repository';
import { CollectionRepository } from '@/repositories/collection.repository';
import { BatchRepository } from '@/repositories/batch.repository';
import { ItemRepository } from '@/repositories/item.repository';
import { CommentRepository } from '@/repositories/comment.repository';
import { WinnerRepository } from '@/repositories/winner.repository';
import { AuditLogRepository } from '@/repositories/audit-log.repository';
import { claimService } from '@/services/claim.service';
import { settingsService } from '@/services/settings.service';
import { MetaComment } from '@/types';
import { winnerIntegrityService } from '@/services/winner-integrity.service';
import { appendSyncDiagnostic, appendSyncTrace } from '@/lib/sync-diagnostics';

export class MetaSyncService {
  private static getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown sync error';
  }

  private static isTokenError(message: string) {
    const normalized = message.toLowerCase();
    return normalized.includes('access token')
      || normalized.includes('session has expired')
      || normalized.includes('oauth')
      || normalized.includes('permissions');
  }

  private static async markPageNeedsReconnect(pageId: string | null | undefined, errorMessage: string) {
    if (!pageId) {
      return;
    }

    await FacebookPageRepository.markPageTokenStatus({
      pageId,
      tokenStatus: 'invalid',
      connectionStatus: 'needs_reconnect',
      lastSyncError: errorMessage,
    });
  }

  /**
   * Syncs batch posts for a collection from a specific date range.
   */
  static async syncCollectionPosts(collectionId: string): Promise<{ success: boolean; postsImported: number; error?: string }> {
    try {
      // 1. Get collection details to know the page and date range
      const collection = await CollectionRepository.getCollectionById(collectionId);
      if (!collection) {
        return { success: false, postsImported: 0, error: 'Collection not found' };
      }

      const page = await FacebookPageRepository.getPageById(collection.page_id);
      if (!page) {
        return { success: false, postsImported: 0, error: 'Linked Facebook Page not found or disconnected' };
      }

      // 2. Fetch posts with date filters
      console.log(`Syncing collection ${collectionId} [${collection.name}] from ${collection.start_date} to ${collection.end_date}`);
      const result = await MetaPostService.getRecentPosts(
        page.id, 
        page.access_token, 
        collection.start_date, 
        collection.end_date
      );
      
      if (result.error) {
        console.error(`[MetaSyncService] Sync failed due to API error: ${result.error}`);
        return { success: false, postsImported: 0, error: result.error };
      }

      const posts = result.data;
      console.log(`Found ${posts.length} posts in range.`);

      let postsImported = 0;
      let totalMediaFound = 0;
      let totalItemsCreated = 0;
      let postsWithMedia = 0;
      let postsSkippedNoMedia = 0;

      for (const post of posts) {
        const batchId = await BatchRepository.upsertBatch({
          collection_id: collectionId,
          meta_post_id: post.id,
          title: post.message?.split('\n')[0] || 'Untitled Batch',
          caption: post.message,
          posted_at: post.created_time,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString()
        });

        if (batchId) {
          postsImported++;

          // --- MEDIA IMPORT ---
          console.log(`[MetaSyncService] Fetching media for batch post: ${post.id}`);
          const media = await MetaMediaService.getPostAttachments(post.id, page.access_token);
          
          if (media.length > 0) {
            postsWithMedia++;
            totalMediaFound += media.length;
            
            for (const [index, m] of media.entries()) {
              const itemId = await ItemRepository.upsertItem({
                collection_id: collectionId,
                batch_post_id: batchId,
                item_number: index + 1,
                meta_media_id: m.id,
                image_url: m.media_url,
                thumbnail_url: m.media_url,
                status: 'unclaimed',
                raw_price_text: m.description || post.message, // Priority: photo description, fallback: post message
                raw_media_json: m.raw || {},
                last_synced_at: new Date().toISOString()
              });
              if (itemId) totalItemsCreated++;
            }
          } else {
            postsSkippedNoMedia++;
            console.log(`[MetaSyncService] Skip: No media found for post ${post.id}`);
          }
        }
      }

      const summary = `[MetaSyncService] SYNC COMPLETE for ${collectionId}:
        - Raw Posts: ${posts.length}
        - Posts Imported: ${postsImported}
        - Posts with Media: ${postsWithMedia}
        - Posts Skipped (No Media): ${postsSkippedNoMedia}
        - Total Media Found: ${totalMediaFound}
        - Total Item Records Created: ${totalItemsCreated}
      `;
      console.log(summary);

      let syncError: string | null = null;
      if (totalItemsCreated === 0 && posts.length > 0) {
          const warning = `[MetaSyncService] WARNING: Found ${posts.length} posts but created 0 items. Check if they are status posts or if media extraction failed for all.`;
          console.warn(warning);
          syncError = `Found ${posts.length} posts but 0 photos were extracted. This might be because the posts contain no images.`;
      } else if (postsImported === 0) {
          syncError = 'No posts found in selected date range';
      }

      // 3. Update collection metrics
      await CollectionRepository.updateCollectionMetrics(collectionId, {
          totalBatchPosts: postsImported,
          totalItems: totalItemsCreated,
          last_synced_at: new Date().toISOString(),
          sync_error: syncError
      });
      await FacebookPageRepository.markSyncSuccess(page.id);

      return { 
        success: true, 
        postsImported, 
        error: postsImported === 0 ? 'No posts found in selected date range' : undefined 
      };
    } catch (error) {
      console.error('Collection Sync Error:', error);
      const message = this.getErrorMessage(error);
      const collection = await CollectionRepository.getCollectionById(collectionId);
      if (this.isTokenError(message)) {
        const page = collection?.page_id ? await FacebookPageRepository.getPageById(collection.page_id) : null;
        await this.markPageNeedsReconnect(page?.id ?? null, message);
      }
      await CollectionRepository.updateCollectionMetrics(collectionId, {
          sync_error: message
      });
      return { success: false, postsImported: 0, error: message };
    }
  }

  /**
   * Deep sync for a specific batch: Items -> Comments -> Decisions.
   */
  static async syncBatchDeep(batchId: string): Promise<boolean> {
    const page = await FacebookPageRepository.getConnectedPage();
    if (!page) return false;

    const batch = await BatchRepository.getBatch(batchId);
    if (!batch || !batch.meta_post_id) return false;

    try {
      await BatchRepository.updateSyncStatus(batchId, 'syncing');

      // 1. Fetch Items (Attachments)
      const media = await MetaMediaService.getPostAttachments(batch.meta_post_id, page.access_token);
      
      for (const [index, m] of media.entries()) {
        const itemId = await ItemRepository.upsertItem({
          batch_post_id: batchId,
          item_number: index + 1,
          meta_media_id: m.id,
          image_url: m.media_url,
          thumbnail_url: m.media_url,
          status: 'unclaimed',
          last_synced_at: new Date().toISOString()
        });

        if (!itemId) continue;

        // 2. Fetch Comments
        const rawComments = await MetaCommentService.getMediaComments(m.id, page.access_token, {
          pageId: page.id,
          batchPostId: batch.meta_post_id,
          itemId,
          rawMedia: m.raw,
        });
        
        if (rawComments.length > 0) {
          const mappedComments = rawComments.map((rc: MetaComment) => {
            const identity = winnerIntegrityService.extractCommentIdentity(rc);
            if (identity.missingBuyerNameReason) {
              appendSyncDiagnostic(
                `[DATA_ISSUE] Item ${itemId}: Comment ${rc.id} buyer_name missing. ${identity.missingBuyerNameReason}\n`,
              );
            }

            return {
              itemId,
              id: rc.id,
              commenterId: identity.buyerId,
              commenterName: identity.storageBuyerName,
              commentText: rc.message,
              commentedAt: rc.created_time
            };
          });

          if (mappedComments.length > 0) {
            await CommentRepository.insertMany(mappedComments);
          }
        }

        // 3. Process Decisions
        await this.processItemDecisions(itemId, rawComments);
      }

      await BatchRepository.updateSyncStatus(batchId, 'synced');
      await BatchRepository.updateBatchSyncMetadata(batchId, {
          last_synced_at: new Date().toISOString(),
          sync_error: null
      });
      await FacebookPageRepository.markSyncSuccess(page.id);

      return true;
    } catch (error) {
      console.error('Batch Sync Deep Error:', error);
      const message = this.getErrorMessage(error);
      if (this.isTokenError(message)) {
        await this.markPageNeedsReconnect(page.id, message);
      }
      await BatchRepository.updateSyncStatus(batchId, 'error');
      await BatchRepository.updateBatchSyncMetadata(batchId, {
          sync_error: message
      });
      return false;
    }
  }

  /**
   * Re-processes an item: Claim detection + Price resolution.
   */
  static async processItemDecisions(itemId: string, rawComments: MetaComment[]): Promise<{ needsReview: boolean }> {
    const settings = await settingsService.getSettings();
    const item = await ItemRepository.getItem(itemId);
    if (!item) return { needsReview: false };
    const traceItemId = process.env.BUYER_TOTAL_TRACE_ITEM_ID?.trim();
    const traceItem = traceItemId === itemId;

    if (traceItem) {
      rawComments.forEach((comment) => appendSyncTrace(`item:${itemId}:raw_comment`, comment));
    }

    // A. Detect Winner
    const claimResult = claimService.processClaims(rawComments, settings);
    claimResult.processedComments.forEach((comment) => {
      if (comment.buyerNameMissingReason) {
        appendSyncDiagnostic(
          `[DATA_ISSUE] Item ${itemId}: Comment ${comment.id} buyer_name missing. ${comment.buyerNameMissingReason}\n`,
        );
      }
      if (traceItem) {
        appendSyncTrace(`item:${itemId}:parsed_comment`, {
          commentId: comment.id,
          buyerName: comment.buyerName,
          buyerId: comment.buyerId,
          buyerNameMissingReason: comment.buyerNameMissingReason,
          matchedKeyword: comment.matchedKeyword,
          canonicalClaimWord: comment.claimWord,
          isValidClaim: comment.isValidClaim,
          isCancelComment: comment.isCancelComment,
          tags: comment.tags,
        });
      }
    });

    let needsReview = claimResult.needsReview;
    let status = 'unclaimed';
    let resolvedPrice: number | null = null;

    if (claimResult.winner) {
      const integrity = winnerIntegrityService.buildWinnerRecordIntegrity({
        buyerId: claimResult.winner.buyerId,
        buyerName: claimResult.winner.buyerName,
        buyerNameMissingReason: claimResult.winner.buyerNameMissingReason,
        winningClaimWord: claimResult.winner.keyword,
        rawPriceText: item.raw_price_text || "",
        claimCodeMapping: settings.claimCodeMapping,
        batchPostId: item.batch_post_id,
      });
      resolvedPrice = integrity.resolvedPrice;
      const requiresManualReview = !!integrity.dataIssue || needsReview;
      const needsPriceReview = !!integrity.pricingIssue;

      if (integrity.dataIssue) {
        appendSyncDiagnostic(`[DATA_ISSUE] Item ${itemId}: ${integrity.dataIssue}\n`);
      }
      if (integrity.pricingIssue) {
        appendSyncDiagnostic(`[PRICING_ISSUE] Item ${itemId}: ${integrity.pricingIssue}\n`);
      }

      await WinnerRepository.saveWinner({
        itemId,
        batchPostId: integrity.batchPostId,
        buyerId: integrity.buyerId,
        commenterId: integrity.commenterId,
        buyerName: integrity.buyerName,
        claimWord: integrity.winningClaimWord,
        matchedKeyword: integrity.matchedKeyword,
        resolvedPrice,
        status: requiresManualReview ? 'review_required' : 'auto'
      });

      status = requiresManualReview ? 'needs_review' : 'claimed';
      if (integrity.dataIssue || integrity.pricingIssue) needsReview = true;

      await ItemRepository.updateItem(itemId, {
        status,
        needs_price_review: needsPriceReview,
        winner_claim_word: integrity.winningClaimWord,
        resolved_price: resolvedPrice,
        sync_error: integrity.dataIssue || integrity.pricingIssue,
      });

      if (traceItem || requiresManualReview || needsPriceReview) {
        appendSyncTrace(`item:${itemId}:winner_assigned`, {
          winner: claimResult.winner,
          integrity,
        });
      }
    } else {
      await WinnerRepository.clearWinner(itemId);
      await ItemRepository.updateItem(itemId, {
        status: 'unclaimed',
        needs_price_review: false,
        winner_claim_word: null,
        resolved_price: null,
        sync_error: null,
      });
    }

    // Log the outcome
    await AuditLogRepository.log({
      itemId,
      action: 'item_synced',
      reason: needsReview ? 'Item needs review' : 'Item processed successfully',
      details: {
        commentsCount: rawComments.length,
        winner: claimResult.winner?.buyerName || 'none',
        hasPrice: !!resolvedPrice,
        needsReview,
        dataIssue: claimResult.winner
          ? winnerIntegrityService.buildDataIssueReason(
              winnerIntegrityService.normalizeBuyerName(claimResult.winner.buyerName),
              claimResult.winner.buyerNameMissingReason ?? null,
            )
          : null,
      }
    });

    return { needsReview };
  }
}
