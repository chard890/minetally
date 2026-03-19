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
import { FacebookPageRepository } from '@/repositories/facebook-page.repository';
import { winnerIntegrityService } from '@/services/winner-integrity.service';
import { confirmedWinnerService } from '@/services/confirmed-winner.service';
import { appendSyncTrace, getSyncDiagnosticsLogPath } from '@/lib/sync-diagnostics';
import { decryptToken } from '@/lib/token-crypto';
import { revalidatePath } from 'next/cache';
import { MetaComment } from '@/types';

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

function isTokenErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('access token')
    || normalized.includes('session has expired')
    || normalized.includes('oauth')
    || normalized.includes('permissions error')
    || normalized.includes('invalid oauth');
}

async function markPageNeedsReconnect(pageId: string | null | undefined, errorMessage: string) {
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

function buildCommentUpsertInputWithExisting(
  itemId: string,
  rawComment: MetaComment,
  comment: ProcessedComment | null,
  existingComment: ExistingCommentIdentity,
  parentCommentId: string | null,
) {
  const preservedCommenterId =
    winnerIntegrityService.normalizeBuyerId(comment?.buyerId ?? rawComment.from?.id ?? null)
    ?? winnerIntegrityService.normalizeBuyerId(existingComment?.commenterId)
    ?? null;
  const preservedCommenterName =
    winnerIntegrityService.normalizeBuyerName(comment?.buyerName ?? rawComment.from?.name ?? null)
    ?? winnerIntegrityService.normalizeBuyerName(existingComment?.commenterName)
    ?? winnerIntegrityService.unknownCommenterPlaceholder;

  return {
    itemId,
    metaCommentId: rawComment.id,
    parentCommentId,
    commenterId: preservedCommenterId,
    commenterName: preservedCommenterName,
    commentText: rawComment.message || '',
    normalizedText: comment?.normalizedText || null,
    claim_type: comment?.claimWord ?? null,
    isValidClaim: !!comment?.isValidClaim,
    isCancelComment: !!comment?.isCancelComment,
    is_first_claimant: !!comment?.is_first_claimant,
    is_late_claim: !!comment?.is_late_claim,
    isReply: !!rawComment.isReply,
    isPageAuthor: !!rawComment.isPageAuthor,
    rawPayload: rawComment.raw ?? {},
    commented_at: new Date(rawComment.created_time || Date.now()),
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

function hasCommentSourceMetadata(rawMedia: unknown) {
  if (!rawMedia || typeof rawMedia !== 'object') {
    return false;
  }

  const typedRawMedia = rawMedia as Record<string, unknown>;
  return [
    typedRawMedia.attachmentId,
    typedRawMedia.attachmentTargetId,
    typedRawMedia.subattachmentTargetId,
  ].some((value) => typeof value === 'string' && value.trim().length > 0);
}

function getStoredPageAccessToken(token: string | null | undefined) {
  return decryptToken(token) ?? null;
}

async function backfillRawMediaByBatchPost(params: {
  batchPostId: string | null | undefined;
  accessToken: string;
  itemId: string;
  metaMediaId: string;
  currentRawMedia: unknown;
}) {
  if (!params.batchPostId || hasCommentSourceMetadata(params.currentRawMedia)) {
    return params.currentRawMedia;
  }

  const mediaItems = await metaService.getPostMedia(params.batchPostId, params.accessToken);
  const matchedMedia = mediaItems.find((media) => media.id === params.metaMediaId);
  if (!matchedMedia?.raw || !hasCommentSourceMetadata(matchedMedia.raw)) {
    return params.currentRawMedia;
  }

  await prisma.item.update({
    where: { id: params.itemId },
    data: { raw_media_json: matchedMedia.raw },
  });

  return matchedMedia.raw;
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
  const accessToken = getStoredPageAccessToken(collection.page.accessToken);
  if (!accessToken) throw new Error('Facebook Page access token not found');

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
    
    const accessToken = getStoredPageAccessToken(batch.collection.page.accessToken);
    if (!accessToken) throw new Error('Facebook Page access token not found');
    const collectionId = batch.collectionId;
    const settings = await settingsService.getSettings();
    let totalWinnersDetected = 0;

    for (const item of batch.items) {
      if (!item.metaMediaId) {
        appendFileSync(logPath, `[ACTION] Skip: Item ${item.id} has no metaMediaId\n`);
        continue;
      }

      const rawMedia = await backfillRawMediaByBatchPost({
        batchPostId: batch.metaPostId,
        accessToken,
        itemId: item.id,
        metaMediaId: item.metaMediaId,
        currentRawMedia: item.raw_media_json,
      });
      
      appendFileSync(logPath, `[ACTION] Syncing comments for item ${item.id} (media: ${item.metaMediaId})\n`);
      
      const comments = await metaService.getMediaComments(item.metaMediaId, accessToken, {
        pageId: batch.collection.page.metaPageId,
        batchPostId: batch.metaPostId,
        itemId: item.id,
        rawMedia,
      });
      appendFileSync(logPath, `[ACTION] Item ${item.id}: Fetched ${comments.length} raw comments\n`);
      const traceRawComments = shouldTraceItem(item.id);
      if (traceRawComments) {
        comments.forEach((comment) => {
          appendSyncTrace(`item:${item.id}:raw_comment`, comment);
        });
      }
      
      const topLevelComments = comments.filter((comment) => !comment.parentCommentId);
      appendFileSync(logPath, `[ACTION] Item ${item.id}: Processing ${topLevelComments.length} top-level comments with claimService\n`);
      appendFileSync(logPath, `[DEBUG] Current Settings - Valid: ${JSON.stringify(settings.validClaimKeywords)}, Cancel: ${JSON.stringify(settings.cancelKeywords)}\n`);
      
      const { needsReview, processedComments } = claimService.processClaims(topLevelComments, settings);
      const provisionalCommentsById = new Map(processedComments.map((comment) => [comment.id, comment]));
      const confirmedWinner = confirmedWinnerService.resolveWinner({
        itemId: item.id,
        batchPostId: item.batchPostId,
        pageId: batch.collection.page.metaPageId,
        comments,
        provisionalComments: processedComments,
        pictureLevelPriceText: item.rawPriceText,
        postLevelPriceText: batch.caption,
        claimCodeMapping: settings.claimCodeMapping,
      });
      
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
      appendFileSync(logPath, `[ACTION] Item ${item.id}: claimService returned ${processedComments.length} provisional comments. Valid Claims: ${validClaims}. Confirmed winner detected: ${!!confirmedWinner.winner}\n`);

      await prisma.$transaction(async (tx: TransactionClient) => {
        // 1. Save all comments
        const commentDbIdByMetaId = new Map<string, string>();
        for (const rawComment of comments) {
          if (!rawComment || !rawComment.id) {
             appendFileSync(logPath, `[WARN] Skipping null or invalid comment for item ${item.id}\n`);
             continue;
          }
          
          appendFileSync(logPath, `[DEBUG] Upserting comment ${rawComment.id} for item ${item.id}\n`);
          try {
            const existingComment = await tx.comment.findUnique({
              where: { metaCommentId: rawComment.id },
              select: {
                id: true,
                commenterId: true,
                commenterName: true,
              },
            });
            const persistedParentComment =
              rawComment.parentCommentId
                ? await tx.comment.findUnique({
                    where: { metaCommentId: rawComment.parentCommentId },
                    select: { id: true },
                  })
                : null;
            const commentData = buildCommentUpsertInputWithExisting(
              item.id,
              rawComment,
              provisionalCommentsById.get(rawComment.id) ?? null,
              existingComment,
              rawComment.parentCommentId
                ? commentDbIdByMetaId.get(rawComment.parentCommentId) ?? persistedParentComment?.id ?? null
                : null,
            );
            const savedComment = await tx.comment.upsert({
              where: { metaCommentId: rawComment.id },
              create: commentData,
              update: commentData,
              select: { id: true, metaCommentId: true },
            });
            commentDbIdByMetaId.set(savedComment.metaCommentId ?? rawComment.id, savedComment.id);
          } catch (upsertError) {
            appendFileSync(logPath, `[ERROR] Failed to upsert comment ${rawComment.id}: ${getErrorMessage(upsertError)}\n`);
          }
        }

        // 2. Clear existing winner
        await tx.itemWinner.deleteMany({ where: { itemId: item.id } });

        // 3. Save winner and update item
        if (confirmedWinner.winner) {
          totalWinnersDetected++;

          appendFileSync(logPath, `[ACTION] Item ${item.id}: Assigning confirmed winner ${confirmedWinner.winner.buyerName} via reply ${confirmedWinner.winner.confirmationReplyMetaId}\n`);

          const parentComment = await tx.comment.findUnique({
            where: { metaCommentId: confirmedWinner.winner.parentCommentMetaId },
            select: { id: true, commenterId: true, commenterName: true, commentText: true },
          });
          const confirmationReply = await tx.comment.findUnique({
            where: { metaCommentId: confirmedWinner.winner.confirmationReplyMetaId },
            select: { id: true, commentText: true },
          });

          if (!parentComment || !confirmationReply) {
            appendFileSync(logPath, `[ERROR] Item ${item.id}: Could not find internal database IDs for confirmed winner comments.\n`);
          } else {
            const requiresManualReview = confirmedWinner.winner.needsReview || needsReview;
            const needsPriceReview = confirmedWinner.winner.resolvedPrice === null;
            const traceWinner = shouldTraceItem(item.id, requiresManualReview || needsPriceReview);
            if (confirmedWinner.winner.reviewReason) {
              appendFileSync(logPath, `[REVIEW] Item ${item.id}: ${confirmedWinner.winner.reviewReason}\n`);
            }

            if (
              winnerIntegrityService.normalizeBuyerName(parentComment.commenterName) === null
              && confirmedWinner.winner.buyerName.trim().length > 0
            ) {
              await tx.comment.update({
                where: { id: parentComment.id },
                data: {
                  commenterName: confirmedWinner.winner.buyerName,
                  commenterId: parentComment.commenterId ?? confirmedWinner.winner.buyerFacebookId,
                },
              });
            }

            await tx.itemWinner.create({
              data: {
                item: {
                  connect: { id: item.id },
                },
                winnerComment: {
                  connect: { id: parentComment.id },
                },
                parentComment: {
                  connect: { id: parentComment.id },
                },
                confirmationReply: {
                  connect: { id: confirmationReply.id },
                },
                buyerId: confirmedWinner.winner.buyerFacebookId,
                commenterId: confirmedWinner.winner.buyerFacebookId,
                buyerName: confirmedWinner.winner.buyerName,
                buyerCommentMessage: confirmedWinner.winner.buyerCommentMessage,
                confirmationMessage: confirmedWinner.winner.confirmationMessage,
                winning_claim_word: confirmedWinner.winner.claimWord,
                resolvedPrice: confirmedWinner.winner.resolvedPrice,
                pricingSource: confirmedWinner.winner.pricingSource,
                needsReview: requiresManualReview,
                reviewReason: confirmedWinner.winner.reviewReason,
                batchPost: {
                  connect: { id: item.batchPostId },
                },
                status: requiresManualReview ? 'review_required' : 'auto',
                resolved_at: new Date(confirmedWinner.winner.confirmedAt),
              },
            });

            await updateItemClaimState(
              tx,
              item.id,
              requiresManualReview ? 'needs_review' : 'claimed',
              confirmedWinner.winner.resolvedPrice,
              confirmedWinner.winner.claimWord,
              confirmedWinner.winner.reviewReason,
              needsPriceReview,
            );

            if (traceWinner) {
              appendSyncTrace(`item:${item.id}:winner_assigned`, {
                winner: confirmedWinner.winner,
                parentComment,
                confirmationReply,
              });
            }
          }
        } else {
          appendFileSync(logPath, `[DEBUG] Item ${item.id}: No confirmed winner found\n`);
          await updateItemClaimState(
            tx,
            item.id,
            confirmedWinner.needsReview ? 'needs_review' : 'unclaimed',
            null,
            null,
            confirmedWinner.reviewReason,
          );
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
    if (isTokenErrorMessage(errorMessage)) {
      const fallbackBatch = await prisma.batchPost.findUnique({
        where: { id: batchId },
        include: {
          collection: {
            include: { page: true },
          },
        },
      });
      await markPageNeedsReconnect(fallbackBatch?.collection.page?.metaPageId ?? null, errorMessage);
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
    if (!page) throw new Error('Linked Facebook Page not found');
    const accessToken = getStoredPageAccessToken(page?.accessToken);
    if (!accessToken) throw new Error('Facebook Page access token not found');

    const rawMedia = await backfillRawMediaByBatchPost({
      batchPostId: item.batchPost.metaPostId,
      accessToken,
      itemId,
      metaMediaId: item.metaMediaId,
      currentRawMedia: item.raw_media_json,
    });

    const comments = await metaService.getMediaComments(item.metaMediaId, accessToken, {
      pageId: page.metaPageId,
      batchPostId: item.batchPost.metaPostId,
      itemId,
      rawMedia,
    });
    const settings = await settingsService.getSettings();
    if (shouldTraceItem(itemId)) {
      comments.forEach((comment) => appendSyncTrace(`item:${itemId}:raw_comment`, comment));
    }

    const topLevelComments = comments.filter((comment) => !comment.parentCommentId);
    const { needsReview, processedComments } = claimService.processClaims(topLevelComments, settings);
    const provisionalCommentsById = new Map(processedComments.map((comment) => [comment.id, comment]));
    const confirmedWinner = confirmedWinnerService.resolveWinner({
      itemId,
      batchPostId: item.batchPostId,
      pageId: page.metaPageId,
      comments,
      provisionalComments: processedComments,
      pictureLevelPriceText: item.rawPriceText,
      postLevelPriceText: item.batchPost.caption,
      claimCodeMapping: settings.claimCodeMapping,
    });
    appendFileSync(logPath, `[ACTION] Item ${itemId}: claimService returned ${processedComments.length} provisional comments. Confirmed winner: ${confirmedWinner.winner?.buyerName || 'none'}\n`);
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
      const commentDbIdByMetaId = new Map<string, string>();
      for (const rawComment of comments) {
        if (!rawComment || !rawComment.id) continue;
        
        try {
          const existingComment = await tx.comment.findUnique({
            where: { metaCommentId: rawComment.id },
            select: {
              id: true,
              commenterId: true,
              commenterName: true,
            },
          });
          const persistedParentComment =
            rawComment.parentCommentId
              ? await tx.comment.findUnique({
                  where: { metaCommentId: rawComment.parentCommentId },
                  select: { id: true },
                })
              : null;
          const commentData = buildCommentUpsertInputWithExisting(
            itemId,
            rawComment,
            provisionalCommentsById.get(rawComment.id) ?? null,
            existingComment,
            rawComment.parentCommentId
              ? commentDbIdByMetaId.get(rawComment.parentCommentId) ?? persistedParentComment?.id ?? null
              : null,
          );
          const savedComment = await tx.comment.upsert({
            where: { metaCommentId: rawComment.id },
            create: commentData,
            update: commentData,
            select: { id: true, metaCommentId: true },
          });
          commentDbIdByMetaId.set(savedComment.metaCommentId ?? rawComment.id, savedComment.id);
        } catch (upsertError) {
          appendFileSync(logPath, `[ERROR] Failed to upsert comment ${rawComment.id} in syncItemClaims: ${getErrorMessage(upsertError)}\n`);
        }
      }

      // 2. Clear existing winner if any
      await tx.itemWinner.deleteMany({ where: { itemId } });

      // 3. Save winner if exists
      if (confirmedWinner.winner) {
        appendFileSync(logPath, `[ACTION] Item ${itemId}: Assigning confirmed winner ${confirmedWinner.winner.buyerName} via reply ${confirmedWinner.winner.confirmationReplyMetaId}\n`);

        const parentComment = await tx.comment.findUnique({
          where: { metaCommentId: confirmedWinner.winner.parentCommentMetaId },
          select: { id: true, commenterId: true, commenterName: true, commentText: true },
        });
        const confirmationReply = await tx.comment.findUnique({
          where: { metaCommentId: confirmedWinner.winner.confirmationReplyMetaId },
          select: { id: true, commentText: true },
        });

        if (!parentComment || !confirmationReply) {
          appendFileSync(logPath, `[ERROR] Item ${itemId}: Could not find internal database IDs for confirmed winner in syncItemClaims.\n`);
        } else {
          const requiresManualReview = confirmedWinner.winner.needsReview || needsReview;
          const needsPriceReview = confirmedWinner.winner.resolvedPrice === null;
          if (confirmedWinner.winner.reviewReason) {
            appendFileSync(logPath, `[REVIEW] Item ${itemId}: ${confirmedWinner.winner.reviewReason}\n`);
          }

          if (
            winnerIntegrityService.normalizeBuyerName(parentComment.commenterName) === null
            && confirmedWinner.winner.buyerName.trim().length > 0
          ) {
            await tx.comment.update({
              where: { id: parentComment.id },
              data: {
                commenterName: confirmedWinner.winner.buyerName,
                commenterId: parentComment.commenterId ?? confirmedWinner.winner.buyerFacebookId,
              },
            });
          }

          await tx.itemWinner.create({
            data: {
              item: {
                connect: { id: itemId },
              },
              winnerComment: {
                connect: { id: parentComment.id },
              },
              parentComment: {
                connect: { id: parentComment.id },
              },
              confirmationReply: {
                connect: { id: confirmationReply.id },
              },
              buyerId: confirmedWinner.winner.buyerFacebookId,
              commenterId: confirmedWinner.winner.buyerFacebookId,
              buyerName: confirmedWinner.winner.buyerName,
              buyerCommentMessage: confirmedWinner.winner.buyerCommentMessage,
              confirmationMessage: confirmedWinner.winner.confirmationMessage,
              winning_claim_word: confirmedWinner.winner.claimWord,
              resolvedPrice: confirmedWinner.winner.resolvedPrice,
              pricingSource: confirmedWinner.winner.pricingSource,
              needsReview: requiresManualReview,
              reviewReason: confirmedWinner.winner.reviewReason,
              status: requiresManualReview ? 'review_required' : 'auto',
              batchPost: {
                connect: { id: item.batchPostId },
              },
              resolved_at: new Date(confirmedWinner.winner.confirmedAt),
            },
          });

          await updateItemClaimState(
            tx,
            itemId,
            requiresManualReview ? 'needs_review' : 'claimed',
            confirmedWinner.winner.resolvedPrice,
            confirmedWinner.winner.claimWord,
            confirmedWinner.winner.reviewReason,
            needsPriceReview,
          );

          if (shouldTraceItem(itemId, requiresManualReview || needsPriceReview)) {
            appendSyncTrace(`item:${itemId}:winner_assigned`, {
              winner: confirmedWinner.winner,
              parentComment,
              confirmationReply,
            });
          }
        }
      } else {
        appendFileSync(logPath, `[DEBUG] Item ${itemId}: No confirmed winner in syncItemClaims\n`);
        await updateItemClaimState(
          tx,
          itemId,
          confirmedWinner.needsReview ? 'needs_review' : 'unclaimed',
          null,
          null,
          confirmedWinner.reviewReason,
        );
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

      return { success: true, winner: confirmedWinner.winner };
    });

    revalidatePath(`/collections/${item.batchPost.collectionId}`);
    revalidatePath(`/collections/${item.batchPost.collectionId}/batches/${item.batchPostId}`);
    revalidatePath(`/collections/${item.batchPost.collectionId}/items/${itemId}`);
    revalidatePath('/buyers');

    return result;
  } catch (error) {
    appendFileSync(logPath, `[ACTION] syncItemClaims ERROR: ${getErrorMessage(error)}\n`);
    console.error('Error syncing item claims:', error);
    const errorMessage = getErrorMessage(error);
    if (isTokenErrorMessage(errorMessage)) {
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        include: {
          batchPost: {
            include: {
              collection: {
                include: { page: true },
              },
            },
          },
        },
      });
      await markPageNeedsReconnect(item?.batchPost.collection.page?.metaPageId ?? null, errorMessage);
    }
    return { success: false, error: errorMessage };
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
