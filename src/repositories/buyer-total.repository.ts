import { supabase } from '@/lib/supabase';
import { BuyerTotalSummary } from '@/types';

type BuyerTotalWriteInput =
  | BuyerTotalSummary
  | {
      buyerId: string;
      buyerName: string;
      totalItems: number;
      totalAmount: number;
    };

export class BuyerTotalRepository {
  static async listByCollection(collectionId: string) {
    const { data, error } = await supabase
      .from('buyer_totals')
      .select('*')
      .eq('collection_id', collectionId)
      .order('buyer_name', { ascending: true });

    if (error) {
      console.error('Error listing buyer totals:', error);
      return [];
    }
    return data;
  }

  static async replaceCollectionTotals(collectionId: string, totals: BuyerTotalWriteInput[]) {
    // Delete existing totals for this collection
    await supabase.from('buyer_totals').delete().eq('collection_id', collectionId);

    if (totals.length === 0) {
      return true;
    }

    // Insert new totals
    const { error } = await supabase.from('buyer_totals').insert(
      totals.map(t => ({
        collection_id: collectionId,
        buyer_id: t.buyerId,
        buyer_name: t.buyerName,
        total_items: 'totalWonItems' in t ? t.totalWonItems : t.totalItems,
        total_amount: t.totalAmount,
      }))
    );

    if (error) {
      console.error('Error replacing buyer totals:', error);
      return false;
    }
    return true;
  }
}
