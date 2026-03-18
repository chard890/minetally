'use server';
import { appendFileSync } from 'node:fs';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { metaService } from '@/services/meta.service';
import { claimService } from '@/services/claim.service';
import { collectionService } from '@/services/collection.service';
import { settingsService } from '@/services/settings.service';
import { BatchRepository } from '@/repositories/batch.repository';
import { CollectionRepository } from '@/repositories/collection.repository';
import { BuyerTotalRepository } from '@/repositories/buyer-total.repository';
import { AuditLogRepository } from '@/repositories/audit-log.repository';
import { winnerIntegrityService } from '@/services/winner-integrity.service';
import { appendSyncTrace, getSyncDiagnosticsLogPath } from '@/lib/sync-diagnostics';
import { revalidatePath } from 'next/cache';

type TransactionClient = Prisma.TransactionClient;
type ProcessedComment = ReturnType<typeof claimService.processClaims>['processedComments'][number];
type ExistingCommentIdentity = {
  commenterId: string | null;
  commenterName: string;
} | null;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

function getErrorStack(error: unknown) {
  return error instanceof Error ? error.stack ?? '' : '';
}

function buildCommentUpsertInputWithExisting(
  itemId: string,
  comment: ProcessedComment,
  existingComment: ExistingCommentIdentity,
) {
  const preservedCommenterId =
    winnerIntegrityService.normalizeBuyerId(comment.buyerId)
    ?? winnerIntegrityService.normalizeBuyerId(existingComment?.commenterId)
    ?? null;
  const preservedCommenterName =
    winnerIntegrityService.normalizeBuyerName(comment.buyerName)
    ?? winnerIntegrityService.normalizeBuyerName(existingComment?.commenterName)
    ?? winnerIntegrityService.unknownCommenterPlaceholder;

  return {
    itemId,
    metaCommentId: comment.id,
    commenterId: preservedCommenterId,
    commenterName: preservedCommenterName,
    commentText: comment.message || '',
    normalizedText: comment.normalizedText || '',
    isValidClaim: !!comment.isValidClaim,
    isCancelComment: !!comment.isCancelComment,
    is_first_claimant: !!comment.is_first_claimant,
    is_late_claim: !!comment.is_late_claim,
    commented_at: new Date(comment.timestamp || Date.now()),
  };
}

async function updateItemClaimState(
  tx: TransactionClient,
  itemId: string,
  status: 'unclaimed' | 'claimed' | 'needs_review',
  resolvedPrice: number | null,
  winnerClaimWord: string | null,
  syncError: string | null = null,
  needsPriceReview = false,
) {
  // Use Prisma ORM instead of raw SQL to ensure type safety and cache consistency
  await tx.item.update({
    where: { id: itemId },
    data: {
      status: status,
      resolved_price: resolvedPrice,
      winner_claim_word: winnerClaimWord,
      needsPriceReview,
      syncError,
      updatedAt: new Date(),
    }
  });
}

function shouldTraceItem(itemId: string, hasIssue = false) {
  const traceItemId = process.env.BUYER_TOTAL_TRACE_ITEM_ID?.trim();
  return hasIssue || (!!traceItemId && traceItemId === itemId);
}

/**
 * Collection Actions
 */
export async function createCollection(data: {
  pageId: string;
  name: string;
  startDate: Date;
  endDate: Date;
}) {
  const collection = await prisma.collection.create({
    data: {
      ...data,
      status: 'draft',
    },
  });
  revalidatePath('/collections');
  return collection;
}

/**
 * Sync Posts for a collection
 */
export async function syncCollectionPosts(collectionId: string) {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: { page: true },
  });

  if (!collection) throw new Error('Collection not found');
  if (!collection.page) throw new Error('Linked Facebook Page not found');
  if (!collection.page.accessToken) throw new Error('Facebook Page access token not found');

  const accessToken = collection.page.accessToken;

  const posts = await metaService.getPagePosts(
    collection.page.metaPageId,
    accessToken,
    collection.startDate,
    collection.endDate
  );

  for (const post of posts) {
    const dbPost = await prisma.batchPost.upsert({
      where: { metaPostId: post.id },
      create: {
        collectionId,
        metaPostId: post.id,
        title: post.message?.split('\n')[0] || 'Untitled Batch',
        caption: post.message,
        postedAt: new Date(post.created_time),
        sync_status: 'synced',
      },
      update: {
        title: post.message?.split('\n')[0] || 'Untitled Batch',
        caption: post.message,
        sync_status: 'synced',
      },
    });

    // Import media (items) for each post
    const mediaItems = await metaService.getPostMedia(post.id, accessToken);
    
    let itemNumber = 1;
    for (const media of mediaItems) {
      await prisma.item.upsert({
        where: { metaMediaId: media.id },
        create: {
          batchPostId: dbPost.id,
          collection_id: collectionId, // Storing for convenience
          metaMediaId: media.id,
          itemNumber: itemNumber++,
          imageUrl: media.media_url,
          thumbnailUrl: media.media_url,
          rawPriceText: media.description || post.message, // Priority: photo description, fallback: post message
          raw_media_json: media.raw ?? {},
          status: 'unclaimed',
        },
        update: {
          imageUrl: media.media_url,
          thumbnailUrl: media.media_url,
          rawPriceText: media.description || post.message,
          raw_media_json: media.raw ?? {},
        },
      });
    }
  }

  revalidatePath(`/collections/${collectionId}`);
  return { success: true };
}

/**
 * Sync Comments and Process Claims for a whole batch
 */
export async function syncBatchCommentsAction(batchId: string) {
  const logPath = getSyncDiagnosticsLogPath();
  
  try {
    appendFileSync(logPath, `\n[${new Date().toISOString()}] [ACTION] syncBatchCommentsAction START: ${batchId}\n`);
    
    const batch = await prisma.batchPost.findUnique({
      where: { id: batchId },
      include: { 
        collection: { 
          include: { page: true } 
        },
        items: true
      },
    });

    if (!batch) throw new Error('Batch not found');
    if (!batch.collection.page) throw new Error('Linked Facebook Page not found');
    
    const accessToken = batch.collection.page.accessToken;
    const collectionId = batch.collectionId;
    const settings = await settingsService.getSettings();
    let totalWinnersDetected = 0;

    for (const item of batch.items) {
      if (!item.metaMediaId) {
        appendFileSync(logPath, `[ACTION] Skip: Item ${item.id} has no metaMediaId\n`);
        continue;
      }
      
      appendFileSync(logPath, `[ACTION] Syncing comments for item ${item.id} (media: ${item.metaMediaId})\n`);
      
      const comments = await metaService.getMediaComments(item.metaMediaId, accessToken as string, {
        pageId: batch.collection.page.metaPageId,
        batchPostId: batch.metaPostId,
        itemId: item.id,
        rawMedia: item.raw_media_json,
      });
      appendFileSync(logPath, `[ACTION] Item ${item.id}: Fetched ${comments.length} raw comments\n`);
      const traceRawComments = shouldTraceItem(item.id);
      if (traceRawComments) {
        comments.forEach((comment) => {
          appendSyncTrace(`item:${item.id}:raw_comment`, comment);
        });
      }
      
      appendFileSync(logPath, `[ACTION] Item ${item.id}: Processing ${comments.length} comments with claimService\n`);
      appendFileSync(logPath, `[DEBUG] Current Settings - Valid: ${JSON.stringify(settings.validClaimKeywords)}, Cancel: ${JSON.stringify(settings.cancelKeywords)}\n`);
      
      const { winner, needsReview, processedComments } = claimService.processClaims(comments, settings);
      
      processedComments.forEach(pc => {
        appendFileSync(logPath, `[DEBUG] TRACTOR: Msg: "${pc.message}" | normalized: "${pc.normalizedText}" | isValid: ${pc.isValidClaim} | tags: ${pc.tags.join(',')}\n`);
        if (pc.buyerNameMissingReason) {
          appendFileSync(logPath, `[DATA_ISSUE] Item ${item.id}: Comment ${pc.id} buyer_name missing. ${pc.buyerNameMissingReason}\n`);
        }
        if (traceRawComments) {
          appendSyncTrace(`item:${item.id}:parsed_comment`, {
            commentId: pc.id,
            buyerName: pc.buyerName,
            buyerId: pc.buyerId,
            buyerNameMissingReason: pc.buyerNameMissingReason,
            matchedKeyword: pc.matchedKeyword,
            canonicalClaimWord: pc.claimWord,
            isValidClaim: pc.isValidClaim,
            isCancelComment: pc.isCancelComment,
            tags: pc.tags,
          });
        }
      });

      const validClaims = processedComments.filter(c => c && c.isValidClaim).length;
      appendFileSync(logPath, `[ACTION] Item ${item.id}: claimService returned ${processedComments.length} processed comments. Valid Claims: ${validClaims}. Winner detected: ${!!winner}\n`);

      await prisma.$transaction(async (tx: TransactionClient) => {
        // 1. Save all comments
        for (const pc of processedComments) {
          if (!pc || !pc.id) {
             appendFileSync(logPath, `[WARN] Skipping null or invalid comment for item ${item.id}\n`);
             continue;
          }
          
          appendFileSync(logPath, `[DEBUG] Upserting comment ${pc.id} for item ${item.id}\n`);
          try {
            const existingComment = await tx.comment.findUnique({
              where: { metaCommentId: pc.id },
              select: {
                commenterId: true,
                commenterName: true,
              },
            });
            const commentData = buildCommentUpsertInputWithExisting(item.id, pc, existingComment);
            await tx.comment.upsert({
              where: { metaCommentId: pc.id },
              create: commentData,
              update: commentData,
            });
          } catch (upsertError) {
            appendFileSync(logPath, `[ERROR] Failed to upsert comment ${pc.id}: ${getErrorMessage(upsertError)}\n`);
          }
        }

        // 2. Clear existing winner
        await tx.itemWinner.deleteMany({ where: { itemId: item.id } });

        // 3. Save winner and update item
        if (winner) {
          totalWinnersDetected++;

          appendFileSync(logPath, `[ACTION] Item ${item.id}: Assigning winner ${winner.buyerName ?? 'missing buyer name'} (MetaID: ${winner.winnerCommentId})\n`);

          // CRITICAL: winner.winnerCommentId is the Meta ID. We need the database UUID.
          const dbComment = await tx.comment.findUnique({
            where: { metaCommentId: winner.winnerCommentId },
            select: { id: true, commenterId: true, commenterName: true }
          });

          if (!dbComment) {
            appendFileSync(logPath, `[ERROR] Item ${item.id}: Could not find internal database ID for comment ${winner.winnerCommentId}. Skipping winner creation.\n`);
          } else {
            const integrity = winnerIntegrityService.buildWinnerRecordIntegrity({
              buyerId: winner.buyerId,
              buyerName: winner.buyerName,
              buyerNameMissingReason: winner.buyerNameMissingReason,
              fallbackCommenterId: dbComment.commenterId,
              fallbackBuyerName: dbComment.commenterName,
              winningClaimWord: winner.keyword,
              rawPriceText: item.rawPriceText || '',
              claimCodeMapping: settings.claimCodeMapping,
              batchPostId: item.batchPostId,
            });
            const requiresManualReview = !!integrity.dataIssue || needsReview;
            const needsPriceReview = !!integrity.pricingIssue;
            const traceWinner = shouldTraceItem(item.id, requiresManualReview || needsPriceReview);
            if (integrity.dataIssue) {
              appendFileSync(logPath, `[DATA_ISSUE] Item ${item.id}: ${integrity.dataIssue}\n`);
            }
            if (integrity.pricingIssue) {
              appendFileSync(logPath, `[PRICING_ISSUE] Item ${item.id}: ${integrity.pricingIssue}\n`);
            }

            await tx.itemWinner.create({
              data: {
                item: {
                  connect: { id: item.id },
                },
                winnerComment: {
                  connect: { id: dbComment.id },
                },
                buyerId: integrity.buyerId,
                commenterId: integrity.commenterId,
                buyerName: integrity.buyerName,
                winning_claim_word: integrity.winningClaimWord,
                resolvedPrice: integrity.resolvedPrice,
                status: requiresManualReview ? 'review_required' : 'auto',
              },
            });

            await updateItemClaimState(
              tx,
              item.id,
              requiresManualReview ? 'needs_review' : 'claimed',
              integrity.resolvedPrice,
              integrity.winningClaimWord,
              integrity.dataIssue ?? integrity.pricingIssue,
              needsPriceReview,
            );

            if (traceWinner) {
              appendSyncTrace(`item:${item.id}:winner_assigned`, {
                winner,
                dbComment,
                integrity,
              });
            }
          }
        } else {
          appendFileSync(logPath, `[DEBUG] Item ${item.id}: No winner, setting to unclaimed\n`);
          await updateItemClaimState(tx, item.id, 'unclaimed', null, null, null);
        }
      });
    }

    // 4. Update Buyer Totals for the whole collection
    appendFileSync(logPath, `[ACTION] Updating metrics for collection ${collectionId}\n`);
    const aggregates = await collectionService.getBuyerTotals(collectionId);
    const tracedAggregate = batch.items
      .filter((item) => shouldTraceItem(item.id))
      .map((item) => ({
        itemId: item.id,
        buyerTotals: aggregates.filter((buyer) => buyer.items.some((wonItem) => wonItem.itemId === item.id)),
      }));
    tracedAggregate.forEach((entry) => appendSyncTrace(`item:${entry.itemId}:buyer_total`, entry.buyerTotals));
    await BuyerTotalRepository.replaceCollectionTotals(collectionId, aggregates);

    appendFileSync(logPath, `[ACTION] syncBatchCommentsAction COMPLETE for batch ${batchId}.\n`);
    revalidatePath(`/collections/${collectionId}`);
    revalidatePath(`/collections/${collectionId}/batches/${batchId}`);
    revalidatePath('/buyers');
    
    return { success: true, winnersCount: totalWinnersDetected };
  } catch (error) {
    let errorMessage = getErrorMessage(error);
    if (errorMessage.toLowerCase().includes('access token') || errorMessage.toLowerCase().includes('session has expired')) {
      errorMessage = 'Facebook Session Expired: Please go to Settings and reconnect your Facebook Page.';
    }
    
    appendFileSync(logPath, `[ACTION] syncBatchCommentsAction ERROR: ${getErrorMessage(error)}\n${getErrorStack(error)}\n`);
    console.error('Error syncing batch comments:', error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Sync Comments and Process Claims for an item
 */
export async function syncItemClaims(itemId: string) {
  const logPath = getSyncDiagnosticsLogPath();
  
  try {
    appendFileSync(logPath, `\n[${new Date().toISOString()}] [ACTION] syncItemClaims START: ${itemId}\n`);

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: { 
        batchPost: { 
          include: { 
            collection: { 
              include: { page: true } 
            } 
          } 
        } 
      },
    });

    if (!item) throw new Error('Item not found');
    if (!item.metaMediaId) throw new Error('Item media ID not found');

    const page = item.batchPost.collection.page;
    if (!page?.accessToken) throw new Error('Facebook Page access token not found');

    const comments = await metaService.getMediaComments(item.metaMediaId, page.accessToken, {
      pageId: page.metaPageId,
      batchPostId: item.batchPost.metaPostId,
      itemId,
      rawMedia: item.raw_media_json,
    });
    const settings = await settingsService.getSettings();
    if (shouldTraceItem(itemId)) {
      comments.forEach((comment) => appendSyncTrace(`item:${itemId}:raw_comment`, comment));
    }

    const { winner, needsReview, processedComments } = claimService.processClaims(comments, settings);
    appendFileSync(logPath, `[ACTION] Item ${itemId}: claimService returned ${processedComments.length} comments. Winner: ${winner?.buyerName || 'none'}\n`);
    processedComments.forEach((pc) => {
      if (pc.buyerNameMissingReason) {
        appendFileSync(logPath, `[DATA_ISSUE] Item ${itemId}: Comment ${pc.id} buyer_name missing. ${pc.buyerNameMissingReason}\n`);
      }
      if (shouldTraceItem(itemId)) {
        appendSyncTrace(`item:${itemId}:parsed_comment`, {
          commentId: pc.id,
          buyerName: pc.buyerName,
          buyerId: pc.buyerId,
          buyerNameMissingReason: pc.buyerNameMissingReason,
          matchedKeyword: pc.matchedKeyword,
          canonicalClaimWord: pc.claimWord,
          isValidClaim: pc.isValidClaim,
          isCancelComment: pc.isCancelComment,
          tags: pc.tags,
        });
      }
    });

    // Use transaction to save comments and winner
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // 1. Save all comments
      for (const pc of processedComments) {
        if (!pc || !pc.id) continue;
        
        try {
          const existingComment = await tx.comment.findUnique({
            where: { metaCommentId: pc.id },
            select: {
              commenterId: true,
              commenterName: true,
            },
          });
          const commentData = buildCommentUpsertInputWithExisting(itemId, pc, existingComment);
          await tx.comment.upsert({
            where: { metaCommentId: pc.id },
            create: commentData,
            update: commentData,
          });
        } catch (upsertError) {
          appendFileSync(logPath, `[ERROR] Failed to upsert comment ${pc.id} in syncItemClaims: ${getErrorMessage(upsertError)}\n`);
        }
      }

      // 2. Clear existing winner if any
      await tx.itemWinner.deleteMany({ where: { itemId } });

      // 3. Save winner if exists
      if (winner) {
        appendFileSync(logPath, `[ACTION] Item ${itemId}: Assigning winner ${winner.buyerName ?? 'missing buyer name'} (MetaID: ${winner.winnerCommentId})\n`);

        const dbComment = await tx.comment.findUnique({
          where: { metaCommentId: winner.winnerCommentId },
          select: { id: true, commenterId: true, commenterName: true }
        });

        if (!dbComment) {
          appendFileSync(logPath, `[ERROR] Item ${itemId}: Could not find internal database ID for comment ${winner.winnerCommentId} in syncItemClaims.\n`);
        } else {
          const integrity = winnerIntegrityService.buildWinnerRecordIntegrity({
            buyerId: winner.buyerId,
            buyerName: winner.buyerName,
            buyerNameMissingReason: winner.buyerNameMissingReason,
            fallbackCommenterId: dbComment.commenterId,
            fallbackBuyerName: dbComment.commenterName,
            winningClaimWord: winner.keyword,
            rawPriceText: item.rawPriceText || '',
            claimCodeMapping: settings.claimCodeMapping,
            batchPostId: item.batchPostId,
          });
          const requiresManualReview = !!integrity.dataIssue || needsReview;
          const needsPriceReview = !!integrity.pricingIssue;
          if (integrity.dataIssue) {
            appendFileSync(logPath, `[DATA_ISSUE] Item ${itemId}: ${integrity.dataIssue}\n`);
          }
          if (integrity.pricingIssue) {
            appendFileSync(logPath, `[PRICING_ISSUE] Item ${itemId}: ${integrity.pricingIssue}\n`);
          }

          await tx.itemWinner.create({
            data: {
              item: {
                connect: { id: itemId },
              },
              winnerComment: {
                connect: { id: dbComment.id },
              },
              buyerId: integrity.buyerId,
              commenterId: integrity.commenterId,
              buyerName: integrity.buyerName,
              winning_claim_word: integrity.winningClaimWord,
              resolvedPrice: integrity.resolvedPrice,
              status: requiresManualReview ? 'review_required' : 'auto',
            },
          });

          await updateItemClaimState(
            tx,
            itemId,
            requiresManualReview ? 'needs_review' : 'claimed',
            integrity.resolvedPrice,
            integrity.winningClaimWord,
            integrity.dataIssue ?? integrity.pricingIssue,
            needsPriceReview,
          );

          if (shouldTraceItem(itemId, requiresManualReview || needsPriceReview)) {
            appendSyncTrace(`item:${itemId}:winner_assigned`, {
              winner,
              dbComment,
              integrity,
            });
          }
        }
      } else {
        appendFileSync(logPath, `[DEBUG] Item ${itemId}: Setting to unclaimed in syncItemClaims\n`);
        await updateItemClaimState(tx, itemId, 'unclaimed', null, null, null);
      }

      // 4. Update aggregates
      const collectionId = item.batchPost.collectionId;
      const aggregates = await collectionService.getBuyerTotals(collectionId);
      if (shouldTraceItem(itemId)) {
        appendSyncTrace(
          `item:${itemId}:buyer_total`,
          aggregates.filter((buyer) => buyer.items.some((wonItem) => wonItem.itemId === itemId)),
        );
      }
      await BuyerTotalRepository.replaceCollectionTotals(collectionId, aggregates);
      
      // Recalculate metrics
      await CollectionRepository.recalculateCollectionMetrics(collectionId);

      return { success: true, winner };
    });

    revalidatePath(`/collections/${item.batchPost.collectionId}`);
    revalidatePath(`/collections/${item.batchPost.collectionId}/batches/${item.batchPostId}`);
    revalidatePath(`/collections/${item.batchPost.collectionId}/items/${itemId}`);
    revalidatePath('/buyers');

    return result;
  } catch (error) {
    appendFileSync(logPath, `[ACTION] syncItemClaims ERROR: ${getErrorMessage(error)}\n`);
    console.error('Error syncing item claims:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Finalize Collection and Aggregates Totals
 */
export async function finalizeCollection(collectionId: string) {
  // Aggregation for buyer totals
  const aggregates = await collectionService.getBuyerTotals(collectionId);
  await BuyerTotalRepository.replaceCollectionTotals(collectionId, aggregates);
  
  // Recalculate metrics
  await CollectionRepository.recalculateCollectionMetrics(collectionId);

  // Update collection status
  await CollectionRepository.updateCollectionStatus(collectionId, 'finalized', new Date().toISOString());

  return { success: true };
}

/**
 * Delete a collection
 */
export async function deleteCollectionAction(collectionId: string) {
  const logPath = 'K:\\Antigravity Projects\\Dayan App\\tmp\\delete-error.log';
  
  try {
    const startMsg = `[${new Date().toISOString()}] [deleteCollectionAction] START: ${collectionId}\n`;
    appendFileSync(logPath, startMsg);
    
    if (!collectionService) {
      appendFileSync(logPath, `[ERROR] collectionService is UNDEFINED\n`);
      return { success: false, error: 'collectionService is undefined' };
    }

    const success = await collectionService.deleteCollection(collectionId);
    appendFileSync(logPath, `[DEBUG] collectionService.deleteCollection result: ${success}\n`);
    
    if (success) {
      revalidatePath('/collections');
      return { success: true };
    }
    return { success: false, error: 'Database delete failed' };
  } catch (error) {
    const errorMsg = `[${new Date().toISOString()}] [deleteCollectionAction] EXCEPTION: ${getErrorMessage(error)}\n${getErrorStack(error)}\n\n`;
    appendFileSync(logPath, errorMsg);
    console.error('[deleteCollectionAction] ERROR:', error);
    throw error;
  }
}
/**
 * Full Collection Sync Pipeline (Posts -> Items -> Comments -> Winners)
 */
export async function fullCollectionSyncAction(collectionId: string) {
  const logPath = getSyncDiagnosticsLogPath();
  
  try {
    appendFileSync(logPath, `\n[${new Date().toISOString()}] [PIPELINE] fullCollectionSyncAction START: ${collectionId}\n`);
    
    // Stage 1: Sync Posts and Item Photos
    appendFileSync(logPath, `[PIPELINE] Stage 1: Syncing Posts and Items\n`);
    await syncCollectionPosts(collectionId);
    
    // Stage 2: Get all batches created for this collection
    const batches = await BatchRepository.listByCollection(collectionId);
    appendFileSync(logPath, `[PIPELINE] Stage 2: Found ${batches.length} batches to sync comments for\n`);
    
    // Stage 3: Sync Comments and Detect Winners for each batch
    let totalWinners = 0;
    for (const batch of batches) {
      appendFileSync(logPath, `[PIPELINE] Stage 3: Syncing comments for batch ${batch.id} (${batch.title})\n`);
      const result = await syncBatchCommentsAction(batch.id);
      if (result.success) {
        totalWinners += (result.winnersCount || 0);
      }
    }
    
    appendFileSync(logPath, `[PIPELINE] fullCollectionSyncAction COMPLETE. Total winners detected: ${totalWinners}\n`);
    return { success: true, winnersCount: totalWinners };
  } catch (error) {
    appendFileSync(logPath, `[PIPELINE] fullCollectionSyncAction ERROR: ${getErrorMessage(error)}\n`);
    console.error('Error in fullCollectionSyncAction:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function syncAllCollectionBatchCommentsAction(collectionId: string) {
  const logPath = getSyncDiagnosticsLogPath();

  try {
    appendFileSync(logPath, `\n[${new Date().toISOString()}] [PIPELINE] syncAllCollectionBatchCommentsAction START: ${collectionId}\n`);

    const batches = await BatchRepository.listByCollection(collectionId);
    appendFileSync(logPath, `[PIPELINE] Found ${batches.length} batches to sync comments for collection ${collectionId}\n`);

    let totalWinners = 0;

    for (const batch of batches) {
      appendFileSync(logPath, `[PIPELINE] Syncing comments for batch ${batch.id} (${batch.title})\n`);
      const result = await syncBatchCommentsAction(batch.id);
      if (result.success) {
        totalWinners += result.winnersCount || 0;
      }
    }

    revalidatePath(`/collections/${collectionId}`);
    revalidatePath('/buyers');

    appendFileSync(logPath, `[PIPELINE] syncAllCollectionBatchCommentsAction COMPLETE. Total winners detected: ${totalWinners}\n`);
    return { success: true, batchesSynced: batches.length, winnersCount: totalWinners };
  } catch (error) {
    appendFileSync(logPath, `[PIPELINE] syncAllCollectionBatchCommentsAction ERROR: ${getErrorMessage(error)}\n`);
    console.error('Error syncing all collection batch comments:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function overrideCommenterNameAction(params: {
  collectionId: string;
  itemId: string;
  commentId: string;
  commenterName: string;
}) {
  const nextCommenterName = params.commenterName.trim();

  if (!nextCommenterName) {
    return { success: false, error: 'Commenter name is required.' };
  }

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: params.commentId },
      include: {
        item: {
          include: {
            batchPost: {
              select: {
                id: true,
                collectionId: true,
              },
            },
          },
        },
      },
    });

    if (!comment) {
      return { success: false, error: 'Comment not found.' };
    }

    if (comment.itemId !== params.itemId || comment.item.batchPost.collectionId !== params.collectionId) {
      return { success: false, error: 'Comment does not belong to this item.' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id: params.commentId },
        data: {
          commenterName: nextCommenterName,
        },
      });

      const winner = await tx.itemWinner.findUnique({
        where: { itemId: params.itemId },
        select: {
          id: true,
          winnerCommentId: true,
          buyerName: true,
        },
      });

      if (winner?.winnerCommentId === params.commentId) {
        await tx.itemWinner.update({
          where: { id: winner.id },
          data: {
            buyerName: nextCommenterName,
          },
        });
      }
    });

    await AuditLogRepository.log({
      collectionId: params.collectionId,
      batchPostId: comment.item.batchPost.id,
      itemId: params.itemId,
      action: 'commenter_name_override',
      reason: `Manual commenter name override saved for comment ${comment.metaCommentId ?? comment.id}.`,
      details: {
        commentId: params.commentId,
        metaCommentId: comment.metaCommentId,
        previousCommenterName: comment.commenterName,
        nextCommenterName,
      },
    });

    const aggregates = await collectionService.getBuyerTotals(params.collectionId);
    await BuyerTotalRepository.replaceCollectionTotals(params.collectionId, aggregates);
    await CollectionRepository.recalculateCollectionMetrics(params.collectionId);

    revalidatePath(`/collections/${params.collectionId}`);
    revalidatePath(`/collections/${params.collectionId}/batches/${comment.item.batchPost.id}`);
    revalidatePath(`/collections/${params.collectionId}/items/${params.itemId}`);
    revalidatePath('/buyers');

    return { success: true };
  } catch (error) {
    console.error('Error overriding commenter name:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
