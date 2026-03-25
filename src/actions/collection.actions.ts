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
import { ItemRepository } from '@/repositories/item.repository';
import { BuyerTotalRepository } from '@/repositories/buyer-total.repository';
import { AuditLogRepository } from '@/repositories/audit-log.repository';
import { FacebookPageRepository } from '@/repositories/facebook-page.repository';
import { winnerIntegrityService } from '@/services/winner-integrity.service';
import { confirmedWinnerService } from '@/services/confirmed-winner.service';
import { appendSyncDiagnostic, appendSyncTrace, getSyncDiagnosticsLogPath } from '@/lib/sync-diagnostics';
import { decryptToken } from '@/lib/token-crypto';
import { getServiceSupabase } from '@/lib/supabase';
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

const PRICE_REVIEW_REASON = 'Price could not be resolved for the confirmed winner.';

function isTokenErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('access token')
    || normalized.includes('session has expired')
    || normalized.includes('oauth')
    || normalized.includes('permissions error')
    || normalized.includes('invalid oauth');
}

function extractReferencedItemNumber(message: string, maxItemNumber: number) {
  const normalized = message.trim().toLowerCase();
  const patterns = [
    /(?:^|\s)#\s*(\d{1,3})(?=\s|$)/,
    /(?:^|\s)item\s*(\d{1,3})(?=\s|$)/,
    /^(\d{1,3})(?=\s*[a-z#(]|$)/,
    /(?:^|\s)(\d{1,3})(?=\s+(?:mine|grab|steal|m|g|s)\b)/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }

    const itemNumber = Number(match[1]);
    if (Number.isInteger(itemNumber) && itemNumber >= 1 && itemNumber <= maxItemNumber) {
      return itemNumber;
    }
  }

  return null;
}

function groupBatchLevelCommentsByItemNumber(
  comments: MetaComment[],
  maxItemNumber: number,
) {
  const topLevelById = new Map<string, MetaComment>();
  const repliesByParentId = new Map<string, MetaComment[]>();

  comments.forEach((comment) => {
    if (comment.parentCommentId) {
      const replies = repliesByParentId.get(comment.parentCommentId) ?? [];
      replies.push(comment);
      repliesByParentId.set(comment.parentCommentId, replies);
      return;
    }

    topLevelById.set(comment.id, comment);
  });

  const grouped = new Map<number, MetaComment[]>();

  topLevelById.forEach((comment) => {
    const itemNumber = extractReferencedItemNumber(comment.message, maxItemNumber);
    if (!itemNumber) {
      return;
    }

    const thread = [comment, ...(repliesByParentId.get(comment.id) ?? [])];
    const existing = grouped.get(itemNumber) ?? [];
    existing.push(...thread);
    grouped.set(itemNumber, existing);
  });

  return grouped;
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

  await ItemRepository.updateItem(params.itemId, {
    raw_media_json: matchedMedia.raw,
  });

  return matchedMedia.raw;
}

async function getCommentByMetaCommentId(metaCommentId: string) {
  const { data, error } = await getServiceSupabase()
    .from('comments')
    .select('id, meta_comment_id, commenter_id, commenter_name, comment_text')
    .eq('meta_comment_id', metaCommentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data
    ? {
        id: data.id as string,
        metaCommentId: data.meta_comment_id as string,
        commenterId: (data.commenter_id as string | null | undefined) ?? null,
        commenterName: (data.commenter_name as string | undefined) ?? winnerIntegrityService.unknownCommenterPlaceholder,
        commentText: (data.comment_text as string | null | undefined) ?? null,
      }
    : null;
}

async function upsertCommentRecord(input: ReturnType<typeof buildCommentUpsertInputWithExisting>) {
  const { data, error } = await getServiceSupabase()
    .from('comments')
    .upsert({
      item_id: input.itemId,
      meta_comment_id: input.metaCommentId,
      parent_comment_id: input.parentCommentId,
      commenter_id: input.commenterId,
      commenter_name: input.commenterName,
      comment_text: input.commentText,
      normalized_text: input.normalizedText,
      claim_type: input.claim_type,
      is_valid_claim: input.isValidClaim,
      is_cancel_comment: input.isCancelComment,
      is_first_claimant: input.is_first_claimant,
      is_late_claim: input.is_late_claim,
      is_reply: input.isReply,
      is_page_author: input.isPageAuthor,
      raw_payload_json: input.rawPayload,
      commented_at:
        input.commented_at instanceof Date
          ? input.commented_at.toISOString()
          : new Date(input.commented_at).toISOString(),
    }, { onConflict: 'meta_comment_id' })
    .select('id, meta_comment_id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id as string,
    metaCommentId: (data.meta_comment_id as string | null | undefined) ?? input.metaCommentId,
  };
}

async function clearWinnerRecord(itemId: string) {
  const { error } = await getServiceSupabase()
    .from('item_winners')
    .delete()
    .eq('item_id', itemId);

  if (error) {
    throw new Error(error.message);
  }
}

async function createWinnerRecord(params: {
  itemId: string;
  batchPostId: string;
  parentCommentId: string;
  confirmationReplyId: string;
  buyerFacebookId: string | null;
  buyerName: string;
  buyerCommentMessage: string | null;
  confirmationMessage: string;
  claimWord: string | null;
  resolvedPrice: number | null;
  pricingSource: 'picture_level' | 'post_flat' | 'claim_word' | 'unresolved';
  requiresManualReview: boolean;
  reviewReason: string | null;
  confirmedAt: string;
}) {
  const { error } = await getServiceSupabase()
    .from('item_winners')
    .insert({
      item_id: params.itemId,
      batch_post_id: params.batchPostId,
      winner_comment_id: params.parentCommentId,
      parent_comment_id: params.parentCommentId,
      confirmation_reply_id: params.confirmationReplyId,
      buyer_id: params.buyerFacebookId,
      commenter_id: params.buyerFacebookId,
      buyer_name: params.buyerName,
      buyer_comment_message: params.buyerCommentMessage,
      confirmation_message: params.confirmationMessage,
      winning_claim_word: params.claimWord,
      resolved_price: params.resolvedPrice,
      pricing_source: params.pricingSource,
      needs_review: params.requiresManualReview,
      review_reason: params.reviewReason,
      status: params.requiresManualReview ? 'review_required' : 'auto',
      resolved_at: new Date(params.confirmedAt).toISOString(),
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function updateCommentIdentityById(params: {
  id: string;
  commenterId: string | null;
  commenterName: string;
}) {
  const { error } = await getServiceSupabase()
    .from('comments')
    .update({
      commenter_id: params.commenterId,
      commenter_name: params.commenterName,
    })
    .eq('id', params.id);

  if (error) {
    throw new Error(error.message);
  }
}

async function updateItemClaimStateViaSupabase(
  itemId: string,
  status: 'unclaimed' | 'claimed' | 'needs_review',
  resolvedPrice: number | null,
  winnerClaimWord: string | null,
  syncError: string | null = null,
  needsPriceReview = false,
) {
  const updated = await ItemRepository.updateItem(itemId, {
    status,
    resolved_price: resolvedPrice,
    winner_claim_word: winnerClaimWord,
    needs_price_review: needsPriceReview,
    sync_error: syncError,
    updated_at: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error(`Failed to update item ${itemId}.`);
  }
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
export async function syncBatchCommentsAction(
  batchId: string,
  options?: { deferTotalsRefresh?: boolean },
) {
  const logPath = getSyncDiagnosticsLogPath();
  
  try {
    appendFileSync(logPath, `\n[${new Date().toISOString()}] [ACTION] syncBatchCommentsAction START: ${batchId}\n`);

    const batchRow = await BatchRepository.getBatch(batchId);
    if (!batchRow) throw new Error('Batch not found');

    const collection = await CollectionRepository.getCollectionById(batchRow.collection_id);
    if (!collection?.page_id) throw new Error('Linked Facebook Page not found');

    const page = await FacebookPageRepository.getPageById(collection.page_id);
    if (!page) throw new Error('Linked Facebook Page not found');

    const itemRows = await ItemRepository.listByBatchPostId(batchId);
    const batch = {
      id: batchRow.id as string,
      collectionId: batchRow.collection_id as string,
      metaPostId: (batchRow.meta_post_id as string | null | undefined) ?? null,
      caption: (batchRow.caption as string | null | undefined) ?? null,
      items: itemRows.map((item) => ({
        id: item.id as string,
        batchPostId: (item.batch_post_id as string | undefined) ?? batchId,
        itemNumber: item.item_number as number,
        metaMediaId: (item.meta_media_id as string | null | undefined) ?? null,
        raw_media_json: item.raw_media_json,
        rawPriceText: (item.raw_price_text as string | null | undefined) ?? null,
      })),
    };

    const accessToken = page.access_token ?? null;
    const userAccessToken = page.user_access_token ?? null;
    const primaryAccessToken = accessToken ?? userAccessToken;
    if (!primaryAccessToken) throw new Error('Facebook access token not found');
    const collectionId = batch.collectionId;
    const settings = await settingsService.getSettings();
    let totalWinnersDetected = 0;
    let totalCommentsFetched = 0;
    let totalCommentsSaved = 0;
    let totalCommentUpsertErrors = 0;
    let batchLevelCommentsByItemNumber = new Map<number, MetaComment[]>();
    let batchLevelCommentsFetched = false;
    const maxItemNumber = batch.items.reduce((max, item) => Math.max(max, item.itemNumber), 0);

    for (const item of batch.items) {
      if (!item.metaMediaId) {
        appendFileSync(logPath, `[ACTION] Skip: Item ${item.id} has no metaMediaId\n`);
        continue;
      }

      const rawMedia = await backfillRawMediaByBatchPost({
        batchPostId: batch.metaPostId,
        accessToken: primaryAccessToken,
        itemId: item.id,
        metaMediaId: item.metaMediaId,
        currentRawMedia: item.raw_media_json,
      });
      
      appendFileSync(logPath, `[ACTION] Syncing comments for item ${item.id} (media: ${item.metaMediaId})\n`);
      
      let comments = await metaService.getMediaComments(item.metaMediaId, primaryAccessToken, {
        pageId: page.id,
        batchPostId: batch.metaPostId,
        itemId: item.id,
        rawMedia,
      });
      if (comments.length === 0 && userAccessToken && userAccessToken !== accessToken) {
        comments = await metaService.getMediaComments(item.metaMediaId, userAccessToken, {
          pageId: page.id,
          batchPostId: batch.metaPostId,
          itemId: item.id,
          rawMedia,
        });
      }
      let effectiveComments = comments;

      if (comments.length === 0 && batch.metaPostId) {
        if (!batchLevelCommentsFetched) {
          let batchLevelComments = await metaService.getMediaComments(batch.metaPostId, primaryAccessToken, {
            pageId: page.id,
            batchPostId: batch.metaPostId,
            itemId: item.id,
            rawMedia: { sourceKind: 'full_picture_fallback' },
          });
          if (batchLevelComments.length === 0 && userAccessToken && userAccessToken !== accessToken) {
            batchLevelComments = await metaService.getMediaComments(batch.metaPostId, userAccessToken, {
              pageId: page.id,
              batchPostId: batch.metaPostId,
              itemId: item.id,
              rawMedia: { sourceKind: 'full_picture_fallback' },
            });
          }
          batchLevelCommentsByItemNumber = groupBatchLevelCommentsByItemNumber(batchLevelComments, maxItemNumber);
          batchLevelCommentsFetched = true;
          appendFileSync(
            logPath,
            `[ACTION] Batch ${batch.id}: Fetched ${batchLevelComments.length} batch-level comments and mapped ${batchLevelCommentsByItemNumber.size} item threads\n`,
          );
        }

        effectiveComments = batchLevelCommentsByItemNumber.get(item.itemNumber) ?? [];
      }

      appendFileSync(logPath, `[ACTION] Item ${item.id}: Fetched ${effectiveComments.length} raw comments\n`);
      totalCommentsFetched += effectiveComments.length;
      const traceRawComments = shouldTraceItem(item.id);
      if (traceRawComments) {
        effectiveComments.forEach((comment) => {
          appendSyncTrace(`item:${item.id}:raw_comment`, comment);
        });
      }
      
      const topLevelComments = effectiveComments.filter((comment) => !comment.parentCommentId);
      appendFileSync(logPath, `[ACTION] Item ${item.id}: Processing ${topLevelComments.length} top-level comments with claimService\n`);
      appendFileSync(logPath, `[DEBUG] Current Settings - Valid: ${JSON.stringify(settings.validClaimKeywords)}, Cancel: ${JSON.stringify(settings.cancelKeywords)}\n`);
      
      const { needsReview, processedComments } = claimService.processClaims(topLevelComments, settings);
      const provisionalCommentsById = new Map(processedComments.map((comment) => [comment.id, comment]));
      const confirmedWinner = confirmedWinnerService.resolveWinner({
        itemId: item.id,
        batchPostId: item.batchPostId,
        pageId: page.id,
        comments: effectiveComments,
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

      const commentDbIdByMetaId = new Map<string, string>();
      for (const rawComment of effectiveComments) {
        if (!rawComment || !rawComment.id) {
          appendFileSync(logPath, `[WARN] Skipping null or invalid comment for item ${item.id}\n`);
          continue;
        }

        appendFileSync(logPath, `[DEBUG] Upserting comment ${rawComment.id} for item ${item.id}\n`);
        try {
          const existingComment = await getCommentByMetaCommentId(rawComment.id);
          const persistedParentComment =
            rawComment.parentCommentId
              ? await getCommentByMetaCommentId(rawComment.parentCommentId)
              : null;
          const commentData = buildCommentUpsertInputWithExisting(
            item.id,
            rawComment,
            provisionalCommentsById.get(rawComment.id) ?? null,
            existingComment
              ? {
                  commenterId: existingComment.commenterId,
                  commenterName: existingComment.commenterName,
                }
              : null,
            rawComment.parentCommentId
              ? commentDbIdByMetaId.get(rawComment.parentCommentId) ?? persistedParentComment?.id ?? null
              : null,
          );
          const savedComment = await upsertCommentRecord(commentData);
          commentDbIdByMetaId.set(savedComment.metaCommentId, savedComment.id);
          totalCommentsSaved++;
        } catch (upsertError) {
          totalCommentUpsertErrors++;
          appendFileSync(logPath, `[ERROR] Failed to upsert comment ${rawComment.id}: ${getErrorMessage(upsertError)}\n`);
        }
      }

      await clearWinnerRecord(item.id);

      if (confirmedWinner.winner) {
        totalWinnersDetected++;

        appendFileSync(logPath, `[ACTION] Item ${item.id}: Assigning confirmed winner ${confirmedWinner.winner.buyerName} via reply ${confirmedWinner.winner.confirmationReplyMetaId}\n`);

        const parentComment = await getCommentByMetaCommentId(confirmedWinner.winner.parentCommentMetaId);
        const confirmationReply = await getCommentByMetaCommentId(confirmedWinner.winner.confirmationReplyMetaId);

        if (!parentComment || !confirmationReply) {
          appendFileSync(logPath, `[ERROR] Item ${item.id}: Could not find internal database IDs for confirmed winner comments.\n`);
        } else {
          const hasPriceOnlyReview =
            confirmedWinner.winner.needsReview
            && confirmedWinner.winner.reviewReason === PRICE_REVIEW_REASON;
          const requiresManualReview =
            needsReview || (confirmedWinner.winner.needsReview && !hasPriceOnlyReview);
          const needsPriceReview = confirmedWinner.winner.resolvedPrice === null;
          const traceWinner = shouldTraceItem(item.id, requiresManualReview || needsPriceReview);
          if (confirmedWinner.winner.reviewReason) {
            appendFileSync(logPath, `[REVIEW] Item ${item.id}: ${confirmedWinner.winner.reviewReason}\n`);
          }

          if (
            winnerIntegrityService.normalizeBuyerName(parentComment.commenterName) === null
            && confirmedWinner.winner.buyerName.trim().length > 0
          ) {
            await updateCommentIdentityById({
              id: parentComment.id,
              commenterName: confirmedWinner.winner.buyerName,
              commenterId: parentComment.commenterId ?? confirmedWinner.winner.buyerFacebookId,
            });
          }

          await createWinnerRecord({
            itemId: item.id,
            batchPostId: item.batchPostId,
            parentCommentId: parentComment.id,
            confirmationReplyId: confirmationReply.id,
            buyerFacebookId: confirmedWinner.winner.buyerFacebookId,
            buyerName: confirmedWinner.winner.buyerName,
            buyerCommentMessage: confirmedWinner.winner.buyerCommentMessage,
            confirmationMessage: confirmedWinner.winner.confirmationMessage,
            claimWord: confirmedWinner.winner.claimWord,
            resolvedPrice: confirmedWinner.winner.resolvedPrice,
            pricingSource: confirmedWinner.winner.pricingSource,
            requiresManualReview,
            reviewReason: hasPriceOnlyReview ? null : confirmedWinner.winner.reviewReason,
            confirmedAt: confirmedWinner.winner.confirmedAt,
          });

          await updateItemClaimStateViaSupabase(
            item.id,
            requiresManualReview ? 'needs_review' : 'claimed',
            confirmedWinner.winner.resolvedPrice,
            confirmedWinner.winner.claimWord,
            hasPriceOnlyReview ? null : confirmedWinner.winner.reviewReason,
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
        await updateItemClaimStateViaSupabase(
          item.id,
          confirmedWinner.needsReview ? 'needs_review' : 'unclaimed',
          null,
          null,
          confirmedWinner.reviewReason,
        );
      }
    }

    // 4. Update Buyer Totals for the whole collection unless a bulk sync will do it once at the end.
    if (!options?.deferTotalsRefresh) {
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
    }

    appendFileSync(logPath, `[ACTION] syncBatchCommentsAction COMPLETE for batch ${batchId}.\n`);
    revalidatePath(`/collections/${collectionId}`);
    revalidatePath(`/collections/${collectionId}/batches/${batchId}`);
    revalidatePath('/buyers');

    if (totalCommentsFetched === 0) {
      return {
        success: false,
        error: 'No Facebook comments were fetched for this batch.',
        winnersCount: totalWinnersDetected,
        commentsFetched: totalCommentsFetched,
        commentsSaved: totalCommentsSaved,
        commentUpsertErrors: totalCommentUpsertErrors,
      };
    }

    if (totalCommentsSaved === 0 && totalCommentUpsertErrors > 0) {
      return {
        success: false,
        error: 'Facebook comments were fetched but could not be saved to the database.',
        winnersCount: totalWinnersDetected,
        commentsFetched: totalCommentsFetched,
        commentsSaved: totalCommentsSaved,
        commentUpsertErrors: totalCommentUpsertErrors,
      };
    }
    
    return {
      success: true,
      winnersCount: totalWinnersDetected,
      commentsFetched: totalCommentsFetched,
      commentsSaved: totalCommentsSaved,
      commentUpsertErrors: totalCommentUpsertErrors,
    };
  } catch (error) {
    let errorMessage = getErrorMessage(error);
    if (isTokenErrorMessage(errorMessage)) {
      const fallbackBatch = await BatchRepository.getBatch(batchId);
      const fallbackCollection = fallbackBatch?.collection_id
        ? await CollectionRepository.getCollectionById(fallbackBatch.collection_id)
        : null;
      const fallbackPage = fallbackCollection?.page_id
        ? await FacebookPageRepository.getPageById(fallbackCollection.page_id)
        : null;
      await markPageNeedsReconnect(fallbackPage?.id ?? null, errorMessage);
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
          const hasPriceOnlyReview =
            confirmedWinner.winner.needsReview
            && confirmedWinner.winner.reviewReason === PRICE_REVIEW_REASON;
          const requiresManualReview =
            needsReview || (confirmedWinner.winner.needsReview && !hasPriceOnlyReview);
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
              reviewReason: hasPriceOnlyReview ? null : confirmedWinner.winner.reviewReason,
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
            hasPriceOnlyReview ? null : confirmedWinner.winner.reviewReason,
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
  try {
    appendSyncDiagnostic(`[${new Date().toISOString()}] [deleteCollectionAction] START: ${collectionId}\n`);

    if (!collectionService) {
      appendSyncDiagnostic('[deleteCollectionAction] collectionService is UNDEFINED\n');
      return { success: false, error: 'collectionService is undefined' };
    }

    const result = await collectionService.deleteCollection(collectionId);
    appendSyncDiagnostic(`[deleteCollectionAction] collectionService.deleteCollection result: ${JSON.stringify(result)}\n`);

    if (result.success) {
      revalidatePath('/collections');
      return { success: true };
    }
    return { success: false, error: result.error ?? 'Database delete failed' };
  } catch (error) {
    appendSyncDiagnostic(
      `[${new Date().toISOString()}] [deleteCollectionAction] EXCEPTION: ${getErrorMessage(error)}\n${getErrorStack(error)}\n\n`
    );
    console.error('[deleteCollectionAction] ERROR:', error);
    return { success: false, error: getErrorMessage(error) };
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
    const stage1Result = await syncCollectionPosts(collectionId);
    appendFileSync(logPath, `[PIPELINE] Stage 1 result: ${JSON.stringify(stage1Result)}\n`);
    
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
    return {
      success: true,
      winnersCount: totalWinners,
      postsImported: batches.length,
    };
  } catch (error) {
    appendFileSync(logPath, `[PIPELINE] fullCollectionSyncAction ERROR: ${getErrorMessage(error)}\n`);
    console.error('Error in fullCollectionSyncAction:', error);
    return { success: false, error: getErrorMessage(error), postsImported: 0, winnersCount: 0 };
  }
}

export async function syncAllCollectionBatchCommentsAction(collectionId: string) {
  const logPath = getSyncDiagnosticsLogPath();

  try {
    appendFileSync(logPath, `\n[${new Date().toISOString()}] [PIPELINE] syncAllCollectionBatchCommentsAction START: ${collectionId}\n`);

    const batches = await BatchRepository.listByCollection(collectionId);
    appendFileSync(logPath, `[PIPELINE] Found ${batches.length} batches to sync comments for collection ${collectionId}\n`);

    let totalWinners = 0;
    let totalCommentsFetched = 0;
    let totalCommentsSaved = 0;
    let totalCommentUpsertErrors = 0;

    for (const batch of batches) {
      appendFileSync(logPath, `[PIPELINE] Syncing comments for batch ${batch.id} (${batch.title})\n`);
      const result = await syncBatchCommentsAction(batch.id, { deferTotalsRefresh: true });
      if (result.success) {
        totalWinners += result.winnersCount || 0;
      }
      totalCommentsFetched += result.commentsFetched || 0;
      totalCommentsSaved += result.commentsSaved || 0;
      totalCommentUpsertErrors += result.commentUpsertErrors || 0;
    }

    appendFileSync(logPath, `[PIPELINE] Refreshing buyer totals once for collection ${collectionId}\n`);
    const aggregates = await collectionService.getBuyerTotals(collectionId);
    await BuyerTotalRepository.replaceCollectionTotals(collectionId, aggregates);

    revalidatePath(`/collections/${collectionId}`);
    revalidatePath('/buyers');

    appendFileSync(logPath, `[PIPELINE] syncAllCollectionBatchCommentsAction COMPLETE. Total winners detected: ${totalWinners}\n`);
    if (totalCommentsFetched === 0) {
      return {
        success: false,
        error: 'No Facebook comments were fetched for any batch in this collection.',
        batchesSynced: batches.length,
        winnersCount: totalWinners,
        commentsFetched: totalCommentsFetched,
        commentsSaved: totalCommentsSaved,
        commentUpsertErrors: totalCommentUpsertErrors,
      };
    }

    if (totalCommentsSaved === 0 && totalCommentUpsertErrors > 0) {
      return {
        success: false,
        error: 'Facebook comments were fetched but could not be saved to the database.',
        batchesSynced: batches.length,
        winnersCount: totalWinners,
        commentsFetched: totalCommentsFetched,
        commentsSaved: totalCommentsSaved,
        commentUpsertErrors: totalCommentUpsertErrors,
      };
    }

    return {
      success: true,
      batchesSynced: batches.length,
      winnersCount: totalWinners,
      commentsFetched: totalCommentsFetched,
      commentsSaved: totalCommentsSaved,
      commentUpsertErrors: totalCommentUpsertErrors,
    };
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
