'use server';

import { revalidatePath } from 'next/cache';
import { collectionService } from '@/services/collection.service';
import { settingsService } from '@/services/settings.service';
import { CollectionRepository } from '@/repositories/collection.repository';
import { ItemRepository } from '@/repositories/item.repository';
import { WinnerRepository } from '@/repositories/winner.repository';
import { AuditLogRepository } from '@/repositories/audit-log.repository';
import { FacebookPageRepository } from "@/repositories/facebook-page.repository";
import { MetaPageService } from "@/services/meta/meta-graph.service";
import { MetaSyncService } from "@/services/meta/meta-sync.service";
import { BuyerTotalRepository } from '@/repositories/buyer-total.repository';
import { ClaimWord, ItemStatus, SellerSettings } from '@/types';

/**
 * Creates a new collection in Supabase.
 */
export async function createCollectionAction(formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const pageId = formData.get('pageId') as string;

    // Validation
    if (!name || !startDate || !endDate || !pageId) {
      return { error: 'Missing required fields: Name, Start Date, End Date, and Facebook Page are all required.' };
    }

    const result = await CollectionRepository.createCollection({
      name,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      status: 'open',
      page_id: pageId,
    });

    if (result.error) return { error: `Database error: ${result.error}` };
    const id = result.id!;
    
    await AuditLogRepository.log({
        collectionId: id,
        action: 'COLLECTION_CREATED',
        details: { name, startDate, endDate, pageId }
    });

    revalidatePath('/collections');
    return { success: true, id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error('Error in createCollectionAction:', err);
    return { error: `Server error: ${message}` };
  }
}

/**
 * Updates a specific item's resolution (Manual Override, Set Winner, etc.)
 */
export async function updateItemAction(
  collectionId: string,
  batchId: string,
  itemId: string,
  update: {
    status?: ItemStatus;
    winnerBuyerId?: string;
    winnerBuyerName?: string;
    claimWord?: ClaimWord;
    resolvedPrice?: number;
    note?: string;
    lockItem?: boolean;
  }
) {
  if (update.status === 'unclaimed') {
    await WinnerRepository.clearWinner(itemId);
    await ItemRepository.updateItem(itemId, { status: 'unclaimed', is_locked: false });
  } else if (update.winnerBuyerId) {
    await WinnerRepository.saveWinner({
        itemId,
        batchPostId: batchId,
        buyerId: update.winnerBuyerId,
        commenterId: update.winnerBuyerId,
        buyerName: update.winnerBuyerName || null,
        claimWord: update.claimWord || 'mine',
        resolvedPrice: update.resolvedPrice,
        status: 'manual'
    });
    await ItemRepository.updateItem(itemId, { 
        status: 'manual_override', 
        is_locked: update.lockItem || false,
        resolved_price: update.resolvedPrice,
        winner_claim_word: update.claimWord
    });
  }

  if (update.lockItem !== undefined) {
    await ItemRepository.setLockStatus(itemId, update.lockItem);
  }

  await AuditLogRepository.log({
      collectionId,
      batchPostId: batchId,
      itemId,
      action: 'ITEM_UPDATED',
      details: update
  });

  revalidatePath(`/collections/${collectionId}`);
  revalidatePath(`/collections/${collectionId}/batches/${batchId}`);
  revalidatePath(`/collections/${collectionId}/items/${itemId}`);
  revalidatePath('/buyers');
  revalidatePath('/dashboard');

  // Trigger re-aggregation and metrics update
  const aggregates = await collectionService.getBuyerTotals(collectionId);
  await BuyerTotalRepository.replaceCollectionTotals(collectionId, aggregates);
  await CollectionRepository.recalculateCollectionMetrics(collectionId);

  return { success: true };
}

/**
 * Finalizes and locks a collection in Supabase.
 */
export async function finalizeCollectionAction(collectionId: string) {
  const success = await CollectionRepository.updateCollectionStatus(collectionId, 'finalized', new Date().toISOString());
  if (!success) return { error: 'Failed to finalize collection' };
  
  await AuditLogRepository.log({
      collectionId,
      action: 'COLLECTION_FINALIZED'
  });

  revalidatePath(`/collections/${collectionId}`);
  revalidatePath(`/collections/${collectionId}/finalize`);
  revalidatePath('/collections');
  revalidatePath('/dashboard');

  return { success: true };
}

/**
 * Syncs posts for a collection.
 */
export async function syncCollectionAction(collectionId: string) {
    const result = await MetaSyncService.syncCollectionPosts(collectionId);
    
    await AuditLogRepository.log({
        collectionId,
        action: 'COLLECTION_SYNC_STAGE1',
        details: result
    });

    if (!result.success) {
        return { error: result.error || "Failed to sync collection posts." };
    }
    
    revalidatePath(`/collections/${collectionId}`);
    return result;
}

/**
 * Triggers a deep sync for a batch.
 */
export async function syncBatchAction(collectionId: string, batchId: string) {
  const success = await MetaSyncService.syncBatchDeep(batchId);
  if (!success) throw new Error("Failed to sync batch details.");

  const aggregates = await collectionService.getBuyerTotals(collectionId);
  await BuyerTotalRepository.replaceCollectionTotals(collectionId, aggregates);
  await CollectionRepository.recalculateCollectionMetrics(collectionId);
  
  await AuditLogRepository.log({
      collectionId,
      batchPostId: batchId,
      action: 'BATCH_SYNCED'
  });
  
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath(`/collections/${collectionId}/batches/${batchId}`);
  
  return { success: true };
}

/**
 * Updates global seller settings.
 */
export async function updateSettingsAction(newSettings: SellerSettings) {
  const success = await settingsService.updateSettings(newSettings);
  if (!success) return { error: 'Failed to update settings' };
  
  await AuditLogRepository.log({
      action: 'SETTINGS_UPDATED',
      details: newSettings
  });

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  
  return { success: true };
}

/**
 * Connects a Facebook Page.
 */
export async function connectFacebookPageAction(token: string) {
  const managedPages = await MetaPageService.getManagedPages(token);
  if (managedPages.length === 0) {
    throw new Error("No Facebook Pages found for this token.");
  }

  const page = managedPages[0]; 
  const success = await FacebookPageRepository.upsertPage(page);

  if (!success) throw new Error("Failed to save Facebook Page connection.");

  await AuditLogRepository.log({
    action: 'facebook_connected',
    details: {
      pageName: page.name,
      pageId: page.id,
      pageTasks: page.tasks ?? [],
      tokenSource: 'me/accounts page access token',
    }
  });

  revalidatePath('/settings');
}

/**
 * Disconnects the Facebook Page.
 */
export async function disconnectFacebookPageAction() {
  const success = await FacebookPageRepository.disconnectPage();
  if (!success) throw new Error("Failed to disconnect Facebook Page.");

  await AuditLogRepository.log({
    action: 'facebook_disconnected'
  });

  revalidatePath('/settings');
}
