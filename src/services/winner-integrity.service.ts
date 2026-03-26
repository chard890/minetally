import { ClaimCodeMapping, ClaimWord, MetaComment } from "@/types";
import { priceService } from "@/services/price.service";

const UNKNOWN_COMMENTER = "Unknown commenter";
const PLACEHOLDER_NAMES = new Set([
  "",
  UNKNOWN_COMMENTER.toLowerCase(),
  "unknown winner",
  "unknown buyer",
]);

export interface CommentIdentity {
  buyerId: string | null;
  buyerName: string | null;
  storageBuyerName: string;
  missingBuyerNameReason: string | null;
  missingBuyerIdReason: string | null;
}

export interface WinnerRecordIntegrity {
  buyerId: string | null;
  buyerName: string | null;
  commenterId: string | null;
  batchPostId: string | null;
  winningClaimWord: ClaimWord | null;
  matchedKeyword: string | null;
  resolvedPrice: number | null;
  dataIssue: string | null;
  pricingIssue: string | null;
}

class WinnerIntegrityService {
  public readonly unknownCommenterPlaceholder = UNKNOWN_COMMENTER;

  public extractCommentIdentity(comment: MetaComment): CommentIdentity {
    const rawFrom = comment.from;
    const buyerId = this.normalizeOptionalText(rawFrom?.id);
    const buyerName = this.normalizeOptionalText(rawFrom?.name);

    let missingBuyerNameReason: string | null = null;
    let missingBuyerIdReason: string | null = null;

    if (!buyerName) {
      if (!rawFrom) {
        missingBuyerNameReason = "Facebook comment has no `from` object in the API response.";
      } else if (typeof rawFrom.name === "undefined") {
        missingBuyerNameReason = "Facebook comment `from.name` is missing in the API response.";
      } else {
        missingBuyerNameReason = "Facebook comment `from.name` is blank after trimming.";
      }
    }

    if (!buyerId) {
      if (!rawFrom) {
        missingBuyerIdReason = "Facebook comment has no `from` object in the API response.";
      } else if (typeof rawFrom.id === "undefined") {
        missingBuyerIdReason = "Facebook comment `from.id` is missing in the API response.";
      } else {
        missingBuyerIdReason = "Facebook comment `from.id` is blank after trimming.";
      }
    }

    return {
      buyerId,
      buyerName,
      storageBuyerName: buyerName ?? UNKNOWN_COMMENTER,
      missingBuyerNameReason,
      missingBuyerIdReason,
    };
  }

  public normalizeClaimWord(
    claimWord: string | null | undefined,
    claimCodeMapping: ClaimCodeMapping,
  ): ClaimWord | null {
    const normalized = this.normalizeOptionalText(claimWord)?.toLowerCase();
    if (!normalized) {
      return null;
    }

    if (normalized === "mine" || normalized === "grab" || normalized === "steal") {
      return normalized;
    }

    const mappedWord = Object.entries(claimCodeMapping).find(
      ([code]) => code.toLowerCase() === normalized,
    )?.[1];

    return mappedWord ?? (normalized as ClaimWord);
  }

  public normalizeBuyerName(value: string | null | undefined): string | null {
    const normalized = this.normalizeOptionalText(value);
    if (!normalized) {
      return null;
    }

    const cleaned = normalized.replace(/^to\s+/i, "").trim();
    if (!cleaned) {
      return null;
    }

    return PLACEHOLDER_NAMES.has(cleaned.toLowerCase()) ? null : cleaned;
  }

  public normalizeBuyerId(value: string | null | undefined): string | null {
    return this.normalizeOptionalText(value);
  }

  public buildDataIssueReason(buyerName: string | null, missingReason: string | null) {
    if (buyerName) {
      return null;
    }

    return `Winner exists but buyer_name is missing. ${missingReason ?? "No usable buyer name was returned by Facebook."}`;
  }

  public buildPricingIssueReason(
    resolvedPrice: number | null,
    claimWord: ClaimWord | null,
    rawPriceText: string | null | undefined,
  ) {
    if (typeof resolvedPrice === "number") {
      return null;
    }

    if (!claimWord) {
      return "Winner exists but resolved_price is missing because the winning claim word could not be normalized.";
    }

    if (!this.normalizeOptionalText(rawPriceText)) {
      return "Winner exists but resolved_price is missing because the item has no raw price text.";
    }

    return `Winner exists but resolved_price is missing because no price could be resolved for claim word "${claimWord}".`;
  }

  public buildWinnerRecordIntegrity(params: {
    buyerId?: string | null;
    buyerName?: string | null;
    buyerNameMissingReason?: string | null;
    winningClaimWord?: string | null;
    rawPriceText?: string | null;
    claimCodeMapping: ClaimCodeMapping;
    batchPostId?: string | null;
    fallbackCommenterId?: string | null;
    fallbackBuyerName?: string | null;
  }): WinnerRecordIntegrity {
    const buyerId =
      this.normalizeBuyerId(params.buyerId) ?? this.normalizeBuyerId(params.fallbackCommenterId);
    const buyerName =
      this.normalizeBuyerName(params.buyerName) ?? this.normalizeBuyerName(params.fallbackBuyerName);
    const winningClaimWord = this.normalizeClaimWord(
      params.winningClaimWord,
      params.claimCodeMapping,
    );
    const priceMap = priceService.parseRawPriceText(
      params.rawPriceText ?? "",
      params.claimCodeMapping,
    );
    const resolvedPrice = priceService.resolvePrice(priceMap, winningClaimWord);
    const dataIssue = this.buildDataIssueReason(buyerName, params.buyerNameMissingReason ?? null);
    const pricingIssue = this.buildPricingIssueReason(
      resolvedPrice,
      winningClaimWord,
      params.rawPriceText ?? null,
    );

    return {
      buyerId,
      buyerName,
      commenterId: buyerId,
      batchPostId: params.batchPostId ?? null,
      winningClaimWord,
      matchedKeyword: this.normalizeOptionalText(params.winningClaimWord),
      resolvedPrice,
      dataIssue,
      pricingIssue,
    };
  }

  private normalizeOptionalText(value: string | null | undefined) {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
}

export const winnerIntegrityService = new WinnerIntegrityService();
