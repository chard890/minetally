import { z } from 'zod';

export const CollectionStatusSchema = z.enum(['draft', 'open', 'finalized', 'locked']);
export const BatchSyncStatusSchema = z.enum(['not_synced', 'synced', 'syncing', 'error']);
export const ItemStatusSchema = z.enum(['unclaimed', 'claimed', 'needs_review', 'manual_override', 'locked']);
export const WinnerStatusSchema = z.enum(['auto', 'manual', 'review_required']);

export const SellerSettingsSchema = z.object({
  facebookIntegration: z.object({
    connectedPageId: z.string().optional().nullable(),
    connectedPageName: z.string(),
    connectedSince: z.string(),
    syncIntervalLabel: z.string(),
    autoSyncComments: z.boolean(),
    importOnlyCollectionDateRange: z.boolean(),
  }),
  validClaimKeywords: z.array(z.string()),
  cancelKeywords: z.array(z.string()),
  claimCodeMapping: z.record(z.string(), z.string()),
  syncPreferences: z.object({
    syncPhotosFirst: z.boolean(),
    syncCommentsAfterImport: z.boolean(),
    requireThumbnailVerification: z.boolean(),
  }),
  finalizationBehavior: z.object({
    autoReassignOnCancel: z.boolean(),
    lockCollectionOnFinalize: z.boolean(),
    requireReviewBeforeFinalize: z.boolean(),
  }),
});
