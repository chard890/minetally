import { revalidateTag } from "next/cache";

export const dataCacheTags = {
  buyerTotals: (collectionId: string) => `buyer-totals:${collectionId}`,
  winnerAggregationRows: (collectionId: string) => `winner-aggregation-rows:${collectionId}`,
  itemDetail: (itemId: string) => `item-detail:${itemId}`,
};

export function revalidateBuyerData(collectionId: string) {
  revalidateTag(dataCacheTags.buyerTotals(collectionId));
  revalidateTag(dataCacheTags.winnerAggregationRows(collectionId));
}

export function revalidateItemData(itemId: string) {
  revalidateTag(dataCacheTags.itemDetail(itemId));
}
