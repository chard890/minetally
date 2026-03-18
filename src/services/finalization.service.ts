import { CollectionWorkflowDetail, FinalizationSnapshot, FinalizationWarning } from "@/types";
import { buyerTotalService } from "@/services/buyer-total.service";
import { CollectionRepository } from "@/repositories/collection.repository";
import { ItemRepository } from "@/repositories/item.repository";
import { BuyerTotalRepository } from "@/repositories/buyer-total.repository";

class FinalizationService {
  public buildSnapshot(collection: CollectionWorkflowDetail): FinalizationSnapshot {
    const warnings: FinalizationWarning[] = [];
    const buyers = buyerTotalService.aggregateBuyers(collection);

    if (collection.needsReviewCount > 0) {
      warnings.push({
        id: "needs-review",
        title: "Items still need manual review",
        detail: `${collection.needsReviewCount} items still have cancel conflicts, missing prices, or manual review flags.`,
        severity: "warning",
      });
    }

    if (collection.cancelItemsCount > 0) {
      warnings.push({
        id: "cancelled-items",
        title: "Cancelled claims are still present",
        detail: `${collection.cancelItemsCount} items include winner-side cancel comments and should be checked before locking.`,
        severity: "warning",
      });
    }

    const unresolvedItems = collection.totalItemPhotos - collection.totalClaimedItems;

    if (unresolvedItems > 0) {
      warnings.push({
        id: "unclaimed-items",
        title: "Some photos are still unclaimed",
        detail: `${unresolvedItems} item photos have no final winner yet.`,
        severity: "info",
      });
    }

    return {
      collectionId: collection.id,
      collectionName: collection.name,
      totalBuyers: buyers.length,
      totalClaimedItems: collection.totalClaimedItems,
      totalCollectionValue: collection.totalCollectionValue,
      manualOverridesCount: collection.manualOverridesCount,
      needsReviewItems: collection.needsReviewCount,
      cancelItems: collection.cancelItemsCount,
      warnings,
      readyToFinalize: warnings.filter((warning) => warning.severity === "warning").length === 0,
    };
  }

  /**
   * Re-processes the whole collection:
   * 1. Re-aggregates buyer totals
   * 2. Re-calculates collection metrics
   * 3. Persists results to DB
   */
  public async runFinalRecount(collectionId: string): Promise<boolean> {
    const detail = await CollectionRepository.getCollectionDetail(collectionId);
    if (!detail) return false;

    // 1. Re-aggregate Buyer Totals
    const aggregatedTotals = buyerTotalService.aggregateBuyers(detail);
    
    // 2. Persist Buyer Totals to DB
    const success = await BuyerTotalRepository.replaceCollectionTotals(collectionId, aggregatedTotals.map(t => ({
        buyerId: t.buyerId,
        buyerName: t.buyerName,
        totalItems: t.totalWonItems,
        totalAmount: t.totalAmount
    })));

    if (!success) return false;

    // 3. Re-calculate Collection summary metrics
    const totalClaimed = detail.batches.reduce((sum, b) => sum + b.claimedItems, 0);
    const totalValue = detail.batches.reduce((sum, b) => sum + b.items.reduce((acc, i) => acc + (i.resolvedPrice || 0), 0), 0);
    const totalReview = detail.batches.reduce((sum, b) => sum + b.needsReviewCount, 0);

    return await CollectionRepository.updateCollectionMetrics(collectionId, {
        totalClaimed,
        totalValue,
        totalReview
    });
  }
}

export const finalizationService = new FinalizationService();
