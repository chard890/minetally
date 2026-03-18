export type SellerConfirmationParseResult =
  | {
      isValid: true;
      buyerName: string;
    }
  | {
      isValid: false;
      buyerName: null;
      reason: string;
    };

class SellerConfirmationService {
  public parseConfirmationReply(message: string): SellerConfirmationParseResult {
    const trimmedMessage = message.trim();
    if (!trimmedMessage.toLowerCase().endsWith("yours")) {
      return {
        isValid: false,
        buyerName: null,
        reason: 'Reply does not end with "yours".',
      };
    }

    const buyerName = trimmedMessage.slice(0, -5).trim();
    if (!buyerName) {
      return {
        isValid: false,
        buyerName: null,
        reason: 'Reply ends with "yours" but has no buyer name before it.',
      };
    }

    return {
      isValid: true,
      buyerName,
    };
  }
}

export const sellerConfirmationService = new SellerConfirmationService();
