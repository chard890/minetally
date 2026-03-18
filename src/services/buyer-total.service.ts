import { appendSyncDiagnostic } from "@/lib/sync-diagnostics";
import { WinnerAggregationRow } from "@/repositories/winner.repository";
import { BuyerTotalSummary, CollectionWorkflowDetail } from "@/types";
import { winnerIntegrityService } from "@/services/winner-integrity.service";

class BuyerTotalService {
  public aggregateBuyers(collection: CollectionWorkflowDetail): BuyerTotalSummary[] {
    const buyers = new Map<string, BuyerTotalSummary>();

    for (const batch of collection.batches) {
      for (const item of batch.items) {
        const buyerName = winnerIntegrityService.normalizeBuyerName(item.winner?.buyerName ?? null);
        const buyerId = winnerIntegrityService.normalizeBuyerId(item.winner?.buyerId ?? null);
        const resolvedPrice = typeof item.resolvedPrice === "number" ? item.resolvedPrice : null;

        if (!item.winner || !buyerName || resolvedPrice === null) {
          continue;
        }

        const key = buyerName.toLowerCase();
        const currentBuyer = buyers.get(key) ?? {
          buyerId: buyerId ?? `name:${key}`,
          buyerName,
          collectionId: collection.id,
          collectionName: collection.name,
          collectionStatus: collection.status,
          totalWonItems: 0,
          totalAmount: 0,
          items: [],
        };

        currentBuyer.totalWonItems += 1;
        currentBuyer.totalAmount += resolvedPrice;
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

    return [...buyers.values()].sort((left, right) => {
      if (right.totalAmount !== left.totalAmount) {
        return right.totalAmount - left.totalAmount;
      }

      return left.buyerName.localeCompare(right.buyerName);
    });
  }

  public aggregateRows(rows: WinnerAggregationRow[]): BuyerTotalSummary[] {
    const buyers = new Map<string, BuyerTotalSummary>();

    for (const row of rows) {
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
          `[PRICING_ISSUE] Item ${row.itemId}: Winner row skipped from Buyer Totals because resolved_price is missing.\n`,
        );
        continue;
      }

      const key = buyerName.toLowerCase();
      const currentBuyer = buyers.get(key) ?? {
        buyerId: buyerId ?? `name:${key}`,
        buyerName,
        collectionId: row.collectionId,
        collectionName: row.collectionName,
        collectionStatus: row.collectionStatus as BuyerTotalSummary["collectionStatus"],
        totalWonItems: 0,
        totalAmount: 0,
        items: [],
      };

      currentBuyer.totalWonItems += 1;
      currentBuyer.totalAmount += resolvedPrice;
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

    return [...buyers.values()].sort((left, right) => {
      if (right.totalAmount !== left.totalAmount) {
        return right.totalAmount - left.totalAmount;
      }

      return left.buyerName.localeCompare(right.buyerName);
    });
  }
}

export const buyerTotalService = new BuyerTotalService();
