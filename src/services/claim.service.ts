import {
  ClaimResult,
  MetaComment,
  ParsedComment,
  SellerSettings,
  ClaimTag,
} from "@/types";
import { commentParserService } from "@/services/comment-parser.service";
import { winnerIntegrityService } from "@/services/winner-integrity.service";

interface ClaimProcessingResult {
  winner?: ClaimResult;
  needsReview: boolean;
  processedComments: Array<
    ParsedComment & {
      matchedKeyword?: string;
    }
  >;
}

class ClaimService {
  public normalizeText(text: string): string {
    return commentParserService.normalizeText(text);
  }

  public processClaims(
    comments: MetaComment[],
    settings: SellerSettings,
  ): ClaimProcessingResult {
    const sortedComments = [...comments].sort(
      (left, right) =>
        new Date(left.created_time).getTime() - new Date(right.created_time).getTime(),
    );

    let winnerComment: ParsedComment | null = null;
    let needsReview = false;

    const seenBuyers = new Set<string>();

    const processedComments = sortedComments.map((comment) => {
      const normalizedText = this.normalizeText(comment.message);
      const match = commentParserService.parseText(comment.message, settings);
      const tags: ClaimTag[] = [];
      const identity = winnerIntegrityService.extractCommentIdentity(comment);
      const buyerId = identity.buyerId ?? "";
      const buyerName = identity.storageBuyerName;
      const canonicalClaimWord = winnerIntegrityService.normalizeClaimWord(
        match.claimWord,
        settings.claimCodeMapping,
      );

      const hasBuyerIdentity = buyerId.length > 0;

      const buyerHasAlreadyClaimed = hasBuyerIdentity && seenBuyers.has(buyerId);

      if (!hasBuyerIdentity || !identity.buyerName) {
        tags.push("needs review"); // Flag it because identity is missing
      }

      if (match.isCancelComment) {
        tags.push("cancel comment");
      }

      // Valid claim check: Detect claim even if identity is missing, but flag it
      const isValidClaim = match.isValidClaim; 

      if (isValidClaim) {
        if (hasBuyerIdentity && buyerHasAlreadyClaimed) {
          tags.push("invalid comment"); // Duplicate claim by same person
        } else {
          tags.push("valid claim");
          if (hasBuyerIdentity) {
            seenBuyers.add(buyerId);
          }

          if (!winnerComment) {
            tags.push("first claimant");
          } else {
            tags.push("late claim");
          }
        }
      }

      if (!isValidClaim && !match.isCancelComment) {
        tags.push("invalid comment");
      }

      const parsedComment: ParsedComment & { is_late_claim?: boolean, is_first_claimant?: boolean } = {
        id: comment.id,
        buyerId,
        buyerName,
        message: comment.message,
        timestamp: comment.created_time,
        normalizedText,
        claimWord: canonicalClaimWord ?? undefined,
        matchedKeyword: match.claimWord,
        isValidClaim: isValidClaim && !buyerHasAlreadyClaimed,
        isCancelComment: match.isCancelComment,
        tags,
        is_first_claimant: isValidClaim && !buyerHasAlreadyClaimed && !winnerComment,
        is_late_claim: isValidClaim && !buyerHasAlreadyClaimed && !!winnerComment,
        buyerNameMissingReason: identity.missingBuyerNameReason,
        buyerIdMissingReason: identity.missingBuyerIdReason,
      };

      if (!winnerComment && parsedComment.isValidClaim) {
        winnerComment = parsedComment;
      } else if (
        winnerComment &&
        parsedComment.isCancelComment &&
        parsedComment.buyerId === winnerComment.buyerId
      ) {
        needsReview = true;
      }

      return parsedComment;
    });

    if (!winnerComment) {
      return {
        needsReview,
        processedComments,
      };
    }

    const winner: ParsedComment = winnerComment;

    return {
      winner: {
        winnerCommentId: winner.id,
        buyerId: winnerIntegrityService.normalizeBuyerId(winner.buyerId),
        buyerName: winnerIntegrityService.normalizeBuyerName(winner.buyerName),
        claimedAt: new Date(winner.timestamp),
        keyword: winner.claimWord ?? "mine",
        matchedKeyword: winner.matchedKeyword,
        buyerNameMissingReason: winner.buyerNameMissingReason,
      },
      needsReview,
      processedComments,
    };
  }
}

export const claimService = new ClaimService();
