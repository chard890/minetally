import { ClaimWord, RawItemComment, SellerSettings } from "@/types";

interface ParsedTextMatch {
  claimWord?: ClaimWord;
  isValidClaim: boolean;
  isCancelComment: boolean;
}

class CommentParserService {
  public normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  public parseText(message: string, settings: SellerSettings): ParsedTextMatch {
    const normalized = this.normalizeText(message);

    const isCancelComment = settings.cancelKeywords.some((keyword) =>
      this.hasKeyword(normalized, keyword),
    );

    const matchedClaimWords = settings.validClaimKeywords.filter((keyword) =>
      this.hasKeyword(normalized, keyword),
    );

    if (matchedClaimWords.length === 0) {
      return {
        isCancelComment,
        isValidClaim: false,
      };
    }

    return {
      claimWord: matchedClaimWords[0],
      isCancelComment,
      isValidClaim: !isCancelComment,
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
    const matcher =
      keyword.length === 1
        ? new RegExp(`(^|\\s)${escapedKeyword}(?=\\s|$|\\d)`, "i")
        : new RegExp(`(^|\\s)${escapedKeyword}(?=\\s|$)`, "i");

    return matcher.test(normalizedText);
  }
}

export const commentParserService = new CommentParserService();
