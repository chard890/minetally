import { appendSyncDiagnostic } from "@/lib/sync-diagnostics";
import { WinnerAggregationRow } from "@/repositories/winner.repository";
import { BuyerTotalSummary, CollectionWorkflowDetail } from "@/types";
import { winnerIntegrityService } from "@/services/winner-integrity.service";

const PRICE_REVIEW_REASON = "Price could not be resolved for the confirmed winner.";

class BuyerTotalService {
  private buildBuyerSummaryId(buyerKey: string, buyerId: string | null) {
    return `${buyerId ?? "name"}:${buyerKey}`;
  }

  private sortBuyerItems<T extends BuyerTotalSummary>(buyers: T[]): T[] {
    return buyers
      .map((buyer) => ({
        ...buyer,
        items: [...buyer.items].sort(
          (left, right) => new Date(right.claimedAt).getTime() - new Date(left.claimedAt).getTime(),
        ),
      }))
      .sort((left, right) => {
        if (right.totalAmount !== left.totalAmount) {
          return right.totalAmount - left.totalAmount;
        }

        return left.buyerName.localeCompare(right.buyerName);
      });
  }

  public aggregateBuyers(collection: CollectionWorkflowDetail): BuyerTotalSummary[] {
    const buyers = new Map<string, BuyerTotalSummary>();

    for (const batch of collection.batches) {
      for (const item of batch.items) {
        const buyerName = winnerIntegrityService.normalizeBuyerName(item.winner?.buyerName ?? null);
        const buyerId = winnerIntegrityService.normalizeBuyerId(item.winner?.buyerId ?? null);
        const resolvedPrice = typeof item.resolvedPrice === "number" ? item.resolvedPrice : null;

        if (!item.winner || !buyerName) {
          continue;
        }

        const key = buyerName.toLowerCase();
        const currentBuyer = buyers.get(key) ?? {
          buyerId: this.buildBuyerSummaryId(key, buyerId),
          buyerName,
          collectionId: collection.id,
          collectionName: collection.name,
          collectionStatus: collection.status,
          totalWonItems: 0,
          totalAmount: 0,
          items: [],
        };

        currentBuyer.totalWonItems += 1;
        currentBuyer.totalAmount += resolvedPrice ?? 0;
        currentBuyer.items.push({
          itemId: item.id,
          itemNumber: item.itemNumber,
          thumbnailUrl: item.thumbnailUrl,
          batchId: batch.id,
          batchTitle: batch.title,
          claimWord: item.winningClaimWord ?? "mine",
          resolvedPrice,
          claimedAt: item.winner.timestamp,
        });

        buyers.set(key, currentBuyer);
      }
    }

    return this.sortBuyerItems([...buyers.values()]);
  }

  public aggregateRows(rows: WinnerAggregationRow[]): BuyerTotalSummary[] {
    const buyers = new Map<string, BuyerTotalSummary>();

    for (const row of rows) {
      const priceOnlyReview =
        row.needsReview
        && row.reviewReason === PRICE_REVIEW_REASON
        && !row.dataIssue;

      if (row.needsReview && !priceOnlyReview) {
        continue;
      }

      const buyerName = winnerIntegrityService.normalizeBuyerName(row.buyerName);
      const buyerId = winnerIntegrityService.normalizeBuyerId(row.commenterId ?? row.buyerId);
      const resolvedPrice = typeof row.resolvedPrice === "number" ? row.resolvedPrice : null;

      if (!buyerName) {
        appendSyncDiagnostic(
          `[DATA_ISSUE] Item ${row.itemId}: Winner row skipped from Buyer Totals because buyer_name is missing.\n`,
        );
        continue;
      }

      if (resolvedPrice === null) {
        appendSyncDiagnostic(
          `[PRICING_ISSUE] Item ${row.itemId}: Buyer Totals includes winner with pending price because resolved_price is missing.\n`,
        );
      }

      const key = buyerName.toLowerCase();
      const currentBuyer = buyers.get(key) ?? {
        buyerId: this.buildBuyerSummaryId(key, buyerId),
        buyerName,
        collectionId: row.collectionId,
        collectionName: row.collectionName,
        collectionStatus: row.collectionStatus as BuyerTotalSummary["collectionStatus"],
        totalWonItems: 0,
        totalAmount: 0,
        items: [],
      };

      currentBuyer.totalWonItems += 1;
      currentBuyer.totalAmount += resolvedPrice ?? 0;
      currentBuyer.items.push({
        itemId: row.itemId,
        itemNumber: row.itemNumber,
        thumbnailUrl: row.thumbnailUrl,
        batchId: row.batchId,
        batchTitle: row.batchTitle,
        claimWord:
          (winnerIntegrityService.normalizeClaimWord(
            row.winningClaimWord,
            { M: "mine", G: "grab", S: "steal" },
          ) ?? "mine") as BuyerTotalSummary["items"][number]["claimWord"],
        resolvedPrice,
        claimedAt: row.claimedAt ?? new Date(0).toISOString(),
      });

      buyers.set(key, currentBuyer);
    }

    return this.sortBuyerItems([...buyers.values()]);
  }
}

export const buyerTotalService = new BuyerTotalService();
