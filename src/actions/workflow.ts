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
import { inspectMetaAccessToken } from '@/services/meta/meta-token-diagnostics';

const REQUIRED_PAGE_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_read_user_content',
];

const PREFERRED_PAGE_TASKS = ['MODERATE', 'MANAGE'];

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
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    throw new Error('Invalid user token.');
  }

  const tokenInspection = await inspectMetaAccessToken(trimmedToken);
  const tokenScopes = tokenInspection?.scopes ?? [];
  const missingScopes = REQUIRED_PAGE_SCOPES.filter((scope) => !tokenScopes.includes(scope));

  if (missingScopes.length > 0) {
    throw new Error(`User token is missing required permissions: ${missingScopes.join(', ')}.`);
  }

  const managedPages = await MetaPageService.getManagedPages(trimmedToken);
  if (managedPages.length === 0) {
    throw new Error("Invalid user token or no Facebook Pages found via /me/accounts.");
  }

  const page =
    managedPages.find((candidate) => {
      const tasks = candidate.tasks ?? [];
      return tasks.length === 0 || PREFERRED_PAGE_TASKS.some((task) => tasks.includes(task));
    }) ?? managedPages[0];

  if (!page.access_token?.trim()) {
    throw new Error('Failed to derive page token from /me/accounts.');
  }

  if ((page.tasks ?? []).length > 0 && !PREFERRED_PAGE_TASKS.some((task) => (page.tasks ?? []).includes(task))) {
    throw new Error('Selected Facebook Page is missing the required Page tasks.');
  }

  const success = await FacebookPageRepository.upsertPage({
    ...page,
    userAccessToken: trimmedToken,
    tokenStatus: 'valid',
    connectionStatus: 'active',
    lastSyncError: null,
  });

  if (!success) throw new Error("Failed to save Facebook Page connection.");

  await AuditLogRepository.log({
    action: 'facebook_connected',
    details: {
      tokenTypeReceivedFromForm: tokenInspection?.type ?? 'unknown',
      pagesReturnedByAccounts: managedPages.map((candidate) => ({
        pageId: candidate.id,
        pageName: candidate.name,
        tasks: candidate.tasks ?? [],
        hasPageAccessToken: Boolean(candidate.access_token?.trim()),
      })),
      pageName: page.name,
      pageId: page.id,
      pageTasks: page.tasks ?? [],
      storedPageAccessToken: true,
      tokenSource: 'user token via /me/accounts',
      tokenTypeUsedForSync: 'page_access_token',
      missingScopes,
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
