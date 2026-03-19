export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  tasks?: string[];
  facebook_user_id?: string;
  user_access_token?: string;
  token_status?: string;
  connection_status?: string;
  token_last_validated_at?: string;
  token_type_used_for_sync?: string;
  reconnect_required?: boolean;
  token_expires_at?: string;
  last_sync_error?: string | null;
}

export interface MetaPost {
  id: string;
  message: string;
  created_time: string;
  full_picture?: string;
}

export interface MetaMedia {
  id: string;
  media_url: string;
  media_type: "IMAGE" | "VIDEO";
  description?: string;
  raw?: unknown;
}

export interface MetaComment {
  id: string;
  from?: {
    id?: string;
    name?: string;
  };
  message: string;
  created_time: string;
  parentCommentId?: string | null;
  isReply?: boolean;
  isPageAuthor?: boolean;
  raw?: unknown;
}

export type ClaimWord = "mine" | "grab" | "steal" | "m" | "g" | "s";
export type CollectionStatus = "draft" | "open" | "finalized" | "locked";
export type BatchSyncStatus = "synced" | "syncing" | "pending" | "attention";
export type ItemStatus =
  | "unclaimed"
  | "claimed"
  | "needs_review"
  | "manual_override"
  | "locked";
export type ClaimTag =
  | "valid claim"
  | "first claimant"
  | "late claim"
  | "invalid comment"
  | "needs review"
  | "cancel comment";
export type PriceReviewStatus =
  | "ready"
  | "needs_review"
  | "manual_override"
  | "locked";

export interface ClaimResult {
  winnerCommentId: string;
  buyerId: string | null;
  buyerName: string | null;
  claimedAt: Date;
  keyword: string;
  matchedKeyword?: string;
  buyerNameMissingReason?: string | null;
}

export interface ClaimCodeMapping {
  [code: string]: ClaimWord;
}

export type PriceMap = Partial<Record<ClaimWord, number>>;

export interface FacebookIntegrationSettings {
  connectedPageName: string;
  connectedSince: string;
  syncIntervalLabel: string;
  autoSyncComments: boolean;
  importOnlyCollectionDateRange: boolean;
  isTokenExpired?: boolean;
}

export interface SyncPreferences {
  syncPhotosFirst: boolean;
  syncCommentsAfterImport: boolean;
  requireThumbnailVerification: boolean;
}

export interface FinalizationBehavior {
  autoReassignOnCancel: boolean;
  lockCollectionOnFinalize: boolean;
  requireReviewBeforeFinalize: boolean;
}

export interface SellerSettings {
  facebookIntegration: FacebookIntegrationSettings;
  validClaimKeywords: ClaimWord[];
  cancelKeywords: string[];
  claimCodeMapping: ClaimCodeMapping;
  syncPreferences: SyncPreferences;
  finalizationBehavior: FinalizationBehavior;
}

export interface RawItemComment {
  id: string;
  buyerId: string;
  buyerName: string;
  message: string;
  timestamp: string;
}

export interface ManualResolution {
  type: "winner" | "unclaimed" | "needs_review";
  buyerId?: string;
  buyerName?: string;
  claimWord?: ClaimWord;
  resolvedPrice?: number | null;
  note: string;
}

export interface ImportedItemSeed {
  id: string;
  itemNumber: number;
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  photoId: string;
  sizeLabel?: string;
  rawPriceText: string;
  sourceBatchPostId: string;
  sourceBatchTitle: string;
  sourcePostUrl: string;
  comments: RawItemComment[];
  manualResolution?: ManualResolution;
  lockItem?: boolean;
}

export interface BatchPostSeed {
  id: string;
  title: string;
  postedAt: string;
  syncStatus: BatchSyncStatus;
  syncNote: string;
  items: ImportedItemSeed[];
}

export interface CollectionSeed {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  finalizeDate?: string;
  status: CollectionStatus;
  connectedFacebookPage: string;
  batches: BatchPostSeed[];
}

export interface ParsedComment {
  id: string;
  buyerId: string;
  buyerName: string;
  message: string;
  timestamp: string;
  normalizedText: string;
  claimWord?: ClaimWord;
  matchedKeyword?: string;
  isValidClaim: boolean;
  isCancelComment: boolean;
  tags: ClaimTag[];
  is_first_claimant?: boolean;
  is_late_claim?: boolean;
  buyerNameMissingReason?: string | null;
  buyerIdMissingReason?: string | null;
}

export interface WinnerSummary {
  buyerId: string;
  buyerName: string;
  commentId?: string;
  timestamp: string;
  claimWord: ClaimWord;
  source: "auto" | "manual";
  note?: string;
}

export interface ItemWorkflowDetail {
  id: string;
  itemNumber: number;
  title: string;
  thumbnailUrl: string;
  imageUrl: string;
  photoId: string;
  sizeLabel?: string;
  rawPriceText: string;
  priceMap: PriceMap;
  sourceBatchPostId: string;
  sourceBatchTitle: string;
  sourcePostUrl: string;
  winner: WinnerSummary | null;
  winningClaimWord: ClaimWord | null;
  resolvedPrice: number | null;
  needsPriceReview: boolean;
  priceReviewStatus: PriceReviewStatus;
  claimStatus: string;
  status: ItemStatus;
  commentCount: number;
  comments: ParsedComment[];
  hasManualOverride: boolean;
  cancelCount: number;
}

export interface BatchWorkflowDetail {
  id: string;
  title: string;
  postedAt: string;
  syncStatus: BatchSyncStatus;
  syncNote: string;
  itemPhotos: number;
  claimedItems: number;
  needsReviewCount: number;
  last_synced_at?: string;
  sync_error?: string | null;
  items: ItemWorkflowDetail[];
}

export interface CollectionWorkflowDetail {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  finalizeDate?: string;
  status: CollectionStatus;
  connectedFacebookPage: string;
  totalBatchPosts: number;
  totalItemPhotos: number;
  totalClaimedItems: number;
  needsReviewCount: number;
  totalCollectionValue: number;
  manualOverridesCount: number;
  cancelItemsCount: number;
  last_synced_at?: string;
  sync_error?: string | null;
  batches: BatchWorkflowDetail[];
}

export interface CollectionListItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  finalizeDate?: string;
  status: CollectionStatus;
  connectedFacebookPage: string;
  totalBatchPosts: number;
  totalItemPhotos: number;
  totalClaimedItems: number;
  needsReviewCount: number;
  totalCollectionValue: number;
}

export interface RecentWinningClaim {
  collectionId: string;
  collectionName: string;
  batchId: string;
  batchTitle: string;
  itemId: string;
  itemNumber: number;
  buyerName: string;
  claimWord: ClaimWord;
  claimedAt: string;
  resolvedPrice: number | null;
  thumbnailUrl: string;
}

export interface DashboardSnapshot {
  activeCollections: number;
  importedBatchPosts: number;
  claimedItems: number;
  needsReview: number;
  totalCollectionValue: number;
  activeCollection?: CollectionWorkflowDetail;
  recentWinningClaims: RecentWinningClaim[];
  recentFinalizedCollections: CollectionListItem[];
}

export interface BuyerWonItem {
  itemId: string;
  itemNumber: number;
  thumbnailUrl: string;
  batchId: string;
  batchTitle: string;
  claimWord: ClaimWord;
  resolvedPrice: number | null;
  claimedAt: string;
}

export interface BuyerTotalSummary {
  buyerId: string;
  buyerName: string;
  collectionId: string;
  collectionName: string;
  collectionStatus: CollectionStatus;
  totalWonItems: number;
  totalAmount: number;
  items: BuyerWonItem[];
}

export interface FinalizationWarning {
  id: string;
  title: string;
  detail: string;
  severity: "warning" | "info";
}

export interface FinalizationSnapshot {
  collectionId: string;
  collectionName: string;
  totalBuyers: number;
  totalClaimedItems: number;
  totalCollectionValue: number;
  manualOverridesCount: number;
  needsReviewItems: number;
  cancelItems: number;
  warnings: FinalizationWarning[];
  readyToFinalize: boolean;
}
