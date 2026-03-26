import prisma from "@/lib/prisma";
import { getServiceSupabase } from "@/lib/supabase";
import { appendSyncDiagnostic } from "@/lib/sync-diagnostics";
import { SellerSettings } from "@/types";
import { winnerIntegrityService } from "@/services/winner-integrity.service";

export interface SaveWinnerInput {
  itemId: string;
  batchPostId?: string | null;
  winnerCommentId?: string | null;
  buyerId?: string | null;
  commenterId?: string | null;
  buyerName?: string | null;
  claimWord?: string | null;
  matchedKeyword?: string | null;
  resolvedPrice?: number | null;
  status?: "auto" | "manual" | "review_required";
  isManualOverride?: boolean;
}

export interface WinnerAggregationRow {
  itemId: string;
  buyerId: string | null;
  commenterId: string | null;
  buyerName: string | null;
  winningClaimWord: string | null;
  resolvedPrice: number | null;
  claimedAt: string | null;
  itemNumber: number;
  thumbnailUrl: string;
  batchId: string;
  batchTitle: string;
  collectionId: string;
  collectionName: string;
  collectionStatus: string;
  commentBuyerName: string | null;
  commentBuyerId: string | null;
  pricingSource: string | null;
  needsReview: boolean;
  reviewReason: string | null;
  dataIssue: string | null;
  pricingIssue: string | null;
}

function buildWinnerCreateData(winner: SaveWinnerInput) {
  return {
    item: {
      connect: { id: winner.itemId },
    },
    winnerComment: winner.winnerCommentId
      ? {
          connect: { id: winner.winnerCommentId },
        }
      : undefined,
    buyerId: winner.buyerId ?? null,
    commenterId: winner.commenterId ?? winner.buyerId ?? null,
    buyerName: winner.buyerName ?? null,
    winning_claim_word: winner.claimWord ?? null,
    resolvedPrice:
      typeof winner.resolvedPrice === "number" ? winner.resolvedPrice : null,
    status: winner.status ?? "auto",
    is_manual_override: winner.isManualOverride ?? false,
    resolved_at: new Date(),
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown winner repair error";
}

export class WinnerRepository {
  static async saveWinner(winner: SaveWinnerInput) {
    try {
      await prisma.itemWinner.deleteMany({
        where: { itemId: winner.itemId },
      });

      await prisma.itemWinner.create({
        data: buildWinnerCreateData(winner),
      });

      return true;
    } catch (error) {
      console.error("Error saving winner:", error);
      return false;
    }
  }

  static async clearWinner(itemId: string) {
    try {
      await prisma.itemWinner.deleteMany({
        where: { itemId },
      });
      return true;
    } catch (error) {
      console.error("Error clearing winner:", error);
      return false;
    }
  }

  static async getByItem(itemId: string) {
    try {
      return await prisma.itemWinner.findFirst({
        where: { itemId },
      });
    } catch (error) {
      console.error("Error fetching winner:", error);
      return null;
    }
  }

  static async repairCollectionWinnerRecords(collectionId: string, settings: SellerSettings) {
    const winners = await prisma.itemWinner.findMany({
      where: {
        item: {
          batchPost: {
            collectionId,
          },
        },
      },
      include: {
        item: true,
        winnerComment: true,
      },
    });

    for (const winner of winners) {
      try {
        const integrity = winnerIntegrityService.buildWinnerRecordIntegrity({
          buyerId: winner.commenterId ?? winner.buyerId,
          buyerName: winner.buyerName,
          fallbackCommenterId: winner.winnerComment?.commenterId ?? null,
          fallbackBuyerName: winner.winnerComment?.commenterName ?? null,
          winningClaimWord: winner.winning_claim_word,
          rawPriceText: winner.item.rawPriceText ?? "",
          claimCodeMapping: settings.claimCodeMapping,
          batchPostId: winner.item.batchPostId,
        });
        const safeResolvedPrice =
          typeof integrity.resolvedPrice === "number" && Number.isFinite(integrity.resolvedPrice)
            ? integrity.resolvedPrice
            : null;

        const requiresManualReview = !!integrity.dataIssue;
        const needsPriceReview = !!integrity.pricingIssue || safeResolvedPrice === null;
        const nextWinnerStatus = requiresManualReview
          ? "review_required"
          : winner.status ?? "auto";
        const nextItemStatus = winner.item.is_locked
          ? "locked"
          : winner.is_manual_override
            ? "manual_override"
            : requiresManualReview
              ? "needs_review"
              : "claimed";

        await prisma.itemWinner.update({
          where: { id: winner.id },
          data: {
            buyerId: integrity.buyerId,
            commenterId: integrity.commenterId,
            buyerName: integrity.buyerName,
            winning_claim_word: integrity.winningClaimWord,
            resolvedPrice: safeResolvedPrice,
            status: nextWinnerStatus,
          },
        });

        await prisma.item.update({
          where: { id: winner.itemId },
          data: {
            status: nextItemStatus,
            winner_claim_word: integrity.winningClaimWord,
            resolved_price: safeResolvedPrice,
            needsPriceReview: needsPriceReview,
            syncError: integrity.dataIssue ?? integrity.pricingIssue,
          },
        });

        if (requiresManualReview || needsPriceReview) {
          appendSyncDiagnostic(
            `[ISSUE] Item ${winner.itemId}: ${integrity.dataIssue ?? integrity.pricingIssue ?? "Winner repair downgraded to review because resolved price is invalid."}\n`,
          );
        }
      } catch (error) {
        const message = getErrorMessage(error);

        appendSyncDiagnostic(
          `[WINNER_REPAIR_FAILED] Winner ${winner.id} for item ${winner.itemId}: ${message}\n`,
        );

        try {
          await prisma.itemWinner.update({
            where: { id: winner.id },
            data: {
              buyerId: winner.commenterId ?? winner.buyerId,
              commenterId: winner.commenterId ?? winner.buyerId,
              buyerName: winnerIntegrityService.normalizeBuyerName(
                winner.buyerName ?? winner.winnerComment?.commenterName ?? null,
              ),
              winning_claim_word: winnerIntegrityService.normalizeClaimWord(
                winner.winning_claim_word,
                settings.claimCodeMapping,
              ),
              resolvedPrice: null,
              status: "review_required",
            },
          });
        } catch (fallbackError) {
          appendSyncDiagnostic(
            `[WINNER_REPAIR_FALLBACK_FAILED] Winner ${winner.id} for item ${winner.itemId}: ${getErrorMessage(fallbackError)}\n`,
          );
        }

        await prisma.item.update({
          where: { id: winner.itemId },
          data: {
            status: winner.item.is_locked
              ? "locked"
              : winner.is_manual_override
                ? "manual_override"
                : "needs_review",
            resolved_price: null,
            needsPriceReview: true,
            syncError: `Winner repair requires manual review: ${message}`,
          },
        });
      }
    }
  }

  static async listAggregationRows(collectionId: string): Promise<WinnerAggregationRow[]> {
    const { data, error } = await getServiceSupabase()
      .from('item_winners')
      .select(`
        item_id,
        buyer_id,
        commenter_id,
        buyer_name,
        winning_claim_word,
        resolved_price,
        resolved_at,
        pricing_source,
        needs_review,
        review_reason,
        items!inner (
          item_number,
          thumbnail_url,
          raw_price_text,
          batch_post_id,
          batch_posts!inner (
            title,
            collection_id,
            collections!inner (
              name,
              status
            )
          )
        ),
        comments!item_winners_winner_comment_id_fkey (
          commenter_id,
          commenter_name
        )
      `)
      .eq('items.batch_posts.collection_id', collectionId)
      .order('resolved_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((winner) => {
      const item = Array.isArray(winner.items) ? winner.items[0] : winner.items;
      const batchPost = item && Array.isArray(item.batch_posts) ? item.batch_posts[0] : item?.batch_posts;
      const collection = batchPost && Array.isArray(batchPost.collections) ? batchPost.collections[0] : batchPost?.collections;
      const winnerComment = Array.isArray(winner.comments) ? winner.comments[0] : winner.comments;

      const buyerName = winnerIntegrityService.normalizeBuyerName((winner.buyer_name as string | null | undefined) ?? null);
      const buyerId = winnerIntegrityService.normalizeBuyerId((winner.commenter_id as string | null | undefined) ?? (winner.buyer_id as string | null | undefined) ?? null);
      const commentBuyerName = winnerIntegrityService.normalizeBuyerName(
        (winnerComment?.commenter_name as string | null | undefined) ?? null,
      );
      const commentBuyerId = winnerIntegrityService.normalizeBuyerId(
        (winnerComment?.commenter_id as string | null | undefined) ?? null,
      );
      const resolvedPriceRaw = winner.resolved_price as number | string | null | undefined;
      const resolvedPrice =
        resolvedPriceRaw === null || typeof resolvedPriceRaw === 'undefined'
          ? null
          : Number(resolvedPriceRaw);
      const rawPriceText = (item?.raw_price_text as string | null | undefined) ?? null;
      const winningClaimWord = (winner.winning_claim_word as string | null | undefined) ?? null;
      const dataIssue = winnerIntegrityService.buildDataIssueReason(
        buyerName ?? commentBuyerName,
        null,
      );
      const pricingIssue = winnerIntegrityService.buildPricingIssueReason(
        resolvedPrice,
        winnerIntegrityService.normalizeClaimWord(
          winningClaimWord,
          { M: "mine", G: "grab", S: "steal" },
        ),
        rawPriceText,
      );

      return {
        itemId: winner.item_id as string,
        buyerId,
        commenterId: buyerId ?? commentBuyerId,
        buyerName: buyerName ?? commentBuyerName,
        winningClaimWord,
        resolvedPrice,
        claimedAt: (winner.resolved_at as string | null | undefined) ?? null,
        itemNumber: Number(item?.item_number ?? 0),
        thumbnailUrl: (item?.thumbnail_url as string | undefined) ?? "",
        batchId: (item?.batch_post_id as string | undefined) ?? "",
        batchTitle: (batchPost?.title as string | undefined) ?? "",
        collectionId: (batchPost?.collection_id as string | undefined) ?? collectionId,
        collectionName: (collection?.name as string | undefined) ?? "",
        collectionStatus: (collection?.status as string | undefined) ?? "open",
        commentBuyerName,
        commentBuyerId,
        pricingSource: (winner.pricing_source as string | null | undefined) ?? null,
        needsReview: Boolean(winner.needs_review),
        reviewReason: (winner.review_reason as string | null | undefined) ?? null,
        dataIssue,
        pricingIssue,
      };
    });
  }
}
