export type SellerConfirmationParseResult =
  | {
      isValid: true;
      buyerName: string | null;
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

<<<<<<< HEAD
    return {
      isValid: true,
      buyerName: trimmedMessage.slice(0, -5).trim() || null,
=======
    const buyerName = trimmedMessage.slice(0, -5).trim();
    return {
      isValid: true,
      buyerName: buyerName || null,
>>>>>>> origin/main
    };
  }
}

export const sellerConfirmationService = new SellerConfirmationService();
