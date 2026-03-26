export type SellerConfirmationParseResult =
  | {
      isValid: true;
      buyerName: string | null;
      claimWord: "mine" | "grab" | "steal" | null;
    }
  | {
      isValid: false;
      buyerName: null;
      claimWord: null;
      reason: string;
    };

class SellerConfirmationService {
  private parseClaimWord(value: string | null | undefined) {
    const normalized = value?.trim().toLowerCase() ?? "";
    if (normalized === "grab" || normalized === "g") {
      return "grab" as const;
    }

    if (normalized === "mine" || normalized === "m") {
      return "mine" as const;
    }

    if (normalized === "steal" || normalized === "s") {
      return "steal" as const;
    }

    return null;
  }

  public parseConfirmationReply(message: string): SellerConfirmationParseResult {
    const trimmedMessage = message.trim().replace(/\s+/g, " ");
    const normalizedMessage = trimmedMessage
      .replace(/\byoursp\b/gi, "yours")
      .replace(/\byours[.!?]+$/i, "yours");
    const leadingYoursMatch = normalizedMessage.match(/^yours[\s:,-]+(.+)$/i);

    if (leadingYoursMatch) {
      const body = leadingYoursMatch[1].trim();
      const viaMatch = body.match(/^(.*?)(?:\s+(?:via|thru|through)\s+)(mine|grab|steal|m|g|s)\b.*$/i);
      const trailingClaimMatch = body.match(/^(.*?)(?:\s+)(mine|grab|steal|m|g|s)\b\s*$/i);
      const buyerName = (viaMatch?.[1] ?? trailingClaimMatch?.[1] ?? body).trim();
      const claimWord = this.parseClaimWord(viaMatch?.[2] ?? trailingClaimMatch?.[2] ?? null);

      return {
        isValid: true,
        buyerName: buyerName || null,
        claimWord,
      };
    }

    const trailingYoursMatch = normalizedMessage.match(/^(.*?)(?:\s+)yours$/i);
    if (!trailingYoursMatch) {
      return {
        isValid: false,
        buyerName: null,
        claimWord: null,
        reason: 'Reply does not match a supported "yours" confirmation format.',
      };
    }

    const buyerName = trailingYoursMatch[1].trim();
    return {
      isValid: true,
      buyerName: buyerName || null,
      claimWord: null,
    };
  }
}

export const sellerConfirmationService = new SellerConfirmationService();
