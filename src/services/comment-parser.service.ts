import { ClaimWord, RawItemComment, SellerSettings } from "@/types";

interface ParsedTextMatch {
  claimWord?: ClaimWord;
  isValidClaim: boolean;
  isCancelComment: boolean;
}

class CommentParserService {
  public normalizeText(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, " ");
  }

  public parseText(message: string, settings: SellerSettings): ParsedTextMatch {
    const normalized = this.normalizeText(message);
    
    // Check for cancel keywords: "cancel", "pass", "mine off"
    const isCancelComment = settings.cancelKeywords.some((keyword) =>
      this.hasKeyword(normalized, keyword),
    );

    // Check for valid claim keywords: "mine", "grab", "steal"
    const matchedClaimWords = settings.validClaimKeywords.filter((keyword) =>
      this.hasKeyword(normalized, keyword),
    );

    // If multiple claim words found, or none, it's not a clear valid claim
    if (matchedClaimWords.length === 0) {
      return {
        isCancelComment,
        isValidClaim: false,
      };
    }

    // Return the first matched claim word (usually 'mine', 'grab', or 'steal')
    return {
      claimWord: matchedClaimWords[0],
      isCancelComment,
      isValidClaim: !isCancelComment, // A cancel comment takes precedence
    };
  }

  public toMetaShape(comment: RawItemComment) {
    return {
      id: comment.id,
      from: {
        id: comment.buyerId,
        name: comment.buyerName,
      },
      message: comment.message,
      created_time: comment.timestamp,
    };
  }

  private hasKeyword(normalizedText: string, keyword: string): boolean {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Flexible matcher: allow M, M-100, M100 but not "hammer" matching "m"
    // We want to match the keyword at the start or with a space/hyphen/number prefix/suffix
    const matcher = new RegExp(`(^|[\\s\\-\\)（\\(])(${escapedKeyword})([\\s\\-0-9\\(（\\)]|$)`, "i");

    return matcher.test(normalizedText);
  }
}

export const commentParserService = new CommentParserService();
