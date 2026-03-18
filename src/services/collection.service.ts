import {
  CollectionListItem,
  CollectionWorkflowDetail,
  DashboardSnapshot,
  WinnerSummary,
} from "@/types";
import { buyerTotalService } from "@/services/buyer-total.service";
import { finalizationService } from "@/services/finalization.service";
import { settingsService } from "@/services/settings.service";
import { CollectionRepository } from "@/repositories/collection.repository";
import { WinnerRepository } from "@/repositories/winner.repository";

function buildWinnerSummary(
  winner: WinnerSummary | null,
  hasManualOverride: boolean,
  needsReview: boolean,
  isLocked: boolean,
): string {
  if (!winner) {
    return hasManualOverride
      ? "Seller marked this item as unclaimed."
      : "No valid claim detected from the photo comments.";
  }

  if (hasManualOverride) {
    return `Manual winner saved for ${winner.buyerName}.`;
  }

  if (needsReview) {
    return `Auto winner ${winner.buyerName} still needs review before finalize.`;
  }

  if (isLocked) {
    return `Winner ${winner.buyerName} is locked for this item.`;
  }

  return `First valid claimant is ${winner.buyerName}.`;
}

class CollectionService {
  /**
   * Refreshes the local store is no longer needed with Supabase, 
   * but we can keep it as a no-op or trigger revalidation if using a cache.
   */
  public async refresh() {
    // No-op for now as we query directly
  }

  public async getCollections(): Promise<CollectionListItem[]> {
    return await CollectionRepository.listCollections();
  }

  public async getCollection(id: string): Promise<CollectionWorkflowDetail | undefined> {
    const detail = await CollectionRepository.getCollectionDetail(id);
    return detail || undefined;
  }

  public async getBatch(collectionId: string, batchId: string) {
    const collection = await this.getCollection(collectionId);
    return collection?.batches.find((batch) => batch.id === batchId);
  }

  public async getItem(collectionId: string, itemId: string) {
    const collection = await this.getCollection(collectionId);
    return collection?.batches
      .flatMap((batch) => batch.items)
      .find((item) => item.id === itemId);
  }

  public async getBuyerTotals(collectionId: string): Promise<ReturnType<typeof buyerTotalService.aggregateRows>> {
    const settings = await settingsService.getSettings();
    await WinnerRepository.repairCollectionWinnerRecords(collectionId, settings);
    const rows = await WinnerRepository.listAggregationRows(collectionId);
    return buyerTotalService.aggregateRows(rows);
  }

  public async getBuyerDetail(collectionId: string, buyerId: string) {
    const totals = await this.getBuyerTotals(collectionId);
    return totals.find((buyer) => buyer.buyerId === buyerId);
  }

  public async getDashboardSnapshot(): Promise<DashboardSnapshot> {
    const collections = await this.getCollections();
    const activeCollectionSummary = collections.find((c) => c.status === "open") || collections[0];
    
    // In a real app, these would be aggregated queries in a DashboardRepository
    // For now, we perform light aggregation
    const activeCollectionsCount = collections.filter(c => c.status === 'open').length;
    const totalBatchPosts = collections.reduce((acc, c) => acc + c.totalBatchPosts, 0);
    const totalClaimedItems = collections.reduce((acc, c) => acc + c.totalClaimedItems, 0);
    const totalNeedsReview = collections.reduce((acc, c) => acc + c.needsReviewCount, 0);
    const totalValue = collections.reduce((acc, c) => acc + c.totalCollectionValue, 0);

    // Fetch full active collection for detail
    const activeCollection = activeCollectionSummary 
        ? await this.getCollection(activeCollectionSummary.id) 
        : undefined;

    const recentWinningClaims = activeCollection
      ? activeCollection.batches
          .flatMap((batch) =>
            batch.items
              .filter((item) => item.winner)
              .map((item) => ({
                collectionId: activeCollection.id,
                collectionName: activeCollection.name,
                batchId: batch.id,
                batchTitle: batch.title,
                itemId: item.id,
                itemNumber: item.itemNumber,
                buyerName: item.winner!.buyerName,
                claimWord: item.winner!.claimWord,
                claimedAt: item.winner!.timestamp,
                resolvedPrice: item.resolvedPrice,
                thumbnailUrl: item.thumbnailUrl,
              })),
          )
          .sort(
            (left, right) =>
              new Date(right.claimedAt).getTime() - new Date(left.claimedAt).getTime(),
          )
          .slice(0, 6)
      : [];

    const recentFinalizedCollections = collections
      .filter((collection) => collection.status !== "open")
      .sort((left, right) => {
        const rightDate = right.finalizeDate ? new Date(right.finalizeDate).getTime() : 0;
        const leftDate = left.finalizeDate ? new Date(left.finalizeDate).getTime() : 0;
        return rightDate - leftDate;
      })
      .slice(0, 3);

    return {
      activeCollections: activeCollectionsCount,
      importedBatchPosts: totalBatchPosts,
      claimedItems: totalClaimedItems,
      needsReview: totalNeedsReview,
      totalCollectionValue: totalValue,
      activeCollection: activeCollection!, // Should not be undefined if collections exist
      recentWinningClaims,
      recentFinalizedCollections,
    };
  }

  public async getFinalizeSnapshot(collectionId: string) {
    const collection = await this.getCollection(collectionId);
    return collection ? finalizationService.buildSnapshot(collection) : undefined;
  }

  public async deleteCollection(id: string): Promise<boolean> {
    return await CollectionRepository.deleteCollection(id);
  }
}

export const collectionService = new CollectionService();
