import { ClaimCodeMapping, MetaComment, ParsedComment } from "@/types";
import { priceService } from "@/services/price.service";
import { sellerConfirmationService } from "@/services/seller-confirmation.service";
import { winnerIntegrityService } from "@/services/winner-integrity.service";

type ConfirmedWinnerInput = {
  itemId: string;
  batchPostId: string | null;
  pageId: string | null;
  comments: MetaComment[];
  provisionalComments: ParsedComment[];
  pictureLevelPriceText: string | null | undefined;
  postLevelPriceText: string | null | undefined;
  claimCodeMapping: ClaimCodeMapping;
};

export type ConfirmedWinnerResolution =
  | {
      winner: null;
      needsReview: boolean;
      reviewReason: string | null;
    }
  | {
      winner: {
        parentCommentMetaId: string;
        confirmationReplyMetaId: string;
        buyerFacebookId: string | null;
        buyerName: string;
        buyerCommentMessage: string | null;
        confirmationMessage: string;
        confirmedAt: string;
        claimWord: string | null;
        matchedKeyword: string | null;
        resolvedPrice: number | null;
        pricingSource: "picture_level" | "post_flat" | "claim_word" | "unresolved";
        needsReview: boolean;
        reviewReason: string | null;
      };
    };

class ConfirmedWinnerService {
  public resolveWinner(input: ConfirmedWinnerInput): ConfirmedWinnerResolution {
    const commentsById = new Map(input.comments.map((comment) => [comment.id, comment]));
    const provisionalById = new Map(
      input.provisionalComments.map((comment) => [comment.id, comment]),
    );

    const confirmations = input.comments
      .filter((comment) => comment.parentCommentId && comment.isReply && comment.isPageAuthor)
      .map((reply) => ({
        reply,
        parsed: sellerConfirmationService.parseConfirmationReply(reply.message),
        parentComment: commentsById.get(reply.parentCommentId ?? ""),
      }));

    const validConfirmations = confirmations
      .filter((entry) => entry.parsed.isValid)
      .sort(
        (left, right) =>
          new Date(left.reply.created_time).getTime() - new Date(right.reply.created_time).getTime(),
      );

    if (validConfirmations.length === 0) {
      const invalidEntry = confirmations.find((entry) => !entry.parsed.isValid);
      const invalidReason =
        invalidEntry && !invalidEntry.parsed.isValid ? invalidEntry.parsed.reason : null;
      const hasProvisionalClaim = input.provisionalComments.some((comment) => comment.isValidClaim);

      return {
        winner: null,
        needsReview: hasProvisionalClaim || confirmations.length > 0,
        reviewReason:
          invalidReason
          ?? (hasProvisionalClaim ? "No seller confirmation reply found for provisional claims." : null),
      };
    }

    const earliestValidConfirmation = validConfirmations[0];
    const conflictingBuyerNames = new Set(
      validConfirmations
        .map((entry) => {
          if (!entry.parsed.isValid) {
            return "";
          }

          const explicitBuyerName = winnerIntegrityService.normalizeBuyerName(entry.parsed.buyerName);
          const parentBuyerName = winnerIntegrityService.normalizeBuyerName(
            commentsById.get(entry.reply.parentCommentId ?? "")?.from?.name ?? null,
          );
          return (explicitBuyerName ?? parentBuyerName ?? "").toLowerCase();
        })
        .filter((name) => name.length > 0),
    );

    let reviewReason: string | null = null;
    let needsReview = false;

    if (!earliestValidConfirmation.parentComment) {
      needsReview = true;
      reviewReason = "Parent child reply mapping is broken for the seller confirmation reply.";
    } else if (conflictingBuyerNames.size > 1) {
      needsReview = true;
      reviewReason = "Multiple seller confirmations with different buyer names were found for this item.";
    } else if (validConfirmations.length > 1) {
      needsReview = true;
      reviewReason = "Multiple seller confirmations were found for this item.";
    }

    const parentProvisional = provisionalById.get(earliestValidConfirmation.parentComment?.id ?? "");
    const explicitBuyerName = earliestValidConfirmation.parsed.isValid
      ? winnerIntegrityService.normalizeBuyerName(earliestValidConfirmation.parsed.buyerName)
      : null;
    const parentBuyerName = winnerIntegrityService.normalizeBuyerName(
      earliestValidConfirmation.parentComment?.from?.name ?? null,
    );
    const fallbackBuyerName = winnerIntegrityService.normalizeBuyerName(parentProvisional?.buyerName ?? null);
    const normalizedClaimWord = winnerIntegrityService.normalizeClaimWord(
      parentProvisional?.claimWord ?? null,
      input.claimCodeMapping,
    );
    const buyerName =
      explicitBuyerName
      ?? parentBuyerName
      ?? fallbackBuyerName
      ?? winnerIntegrityService.unknownCommenterPlaceholder;
    const price = priceService.resolveConfirmedWinnerPrice({
      pictureLevelText: input.pictureLevelPriceText,
      postLevelText: input.postLevelPriceText,
      claimWord: normalizedClaimWord,
      claimCodeMapping: input.claimCodeMapping,
    });

    if (price.resolvedPrice === null) {
      needsReview = true;
      reviewReason = reviewReason ?? "Price could not be resolved for the confirmed winner.";
    }

    return {
      winner: {
        parentCommentMetaId: earliestValidConfirmation.parentComment?.id ?? earliestValidConfirmation.reply.parentCommentId ?? "",
        confirmationReplyMetaId: earliestValidConfirmation.reply.id,
        buyerFacebookId: earliestValidConfirmation.parentComment?.from?.id?.trim() || null,
        buyerName,
        buyerCommentMessage: earliestValidConfirmation.parentComment?.message ?? null,
        confirmationMessage: earliestValidConfirmation.reply.message,
        confirmedAt: earliestValidConfirmation.reply.created_time,
        claimWord: normalizedClaimWord,
        matchedKeyword: parentProvisional?.matchedKeyword ?? null,
        resolvedPrice: price.resolvedPrice,
        pricingSource: price.pricingSource,
        needsReview,
        reviewReason,
      },
    };
  }
}

export const confirmedWinnerService = new ConfirmedWinnerService();
