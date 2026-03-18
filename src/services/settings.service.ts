import { SellerSettings } from "@/types";
import { SettingsRepository } from "@/repositories/settings.repository";

const DEFAULT_SETTINGS: SellerSettings = {
  facebookIntegration: {
    connectedPageName: "Ukay Queen Closet",
    connectedSince: new Date().toISOString(),
    syncIntervalLabel: "Every 10 minutes",
    autoSyncComments: true,
    importOnlyCollectionDateRange: true,
  },
  validClaimKeywords: ["mine", "grab", "steal", "m", "g", "s"],
  cancelKeywords: ["cancel", "pass", "mine off", "c"],
  claimCodeMapping: {
    M: "mine",
    S: "steal",
    G: "grab",
  },
  syncPreferences: {
    syncPhotosFirst: true,
    syncCommentsAfterImport: true,
    requireThumbnailVerification: true,
  },
  finalizationBehavior: {
    autoReassignOnCancel: false,
    lockCollectionOnFinalize: true,
    requireReviewBeforeFinalize: true,
  },
};

class SettingsService {
  /**
   * Fetches settings from Supabase. Falls back to defaults if not found.
   */
  public async getSettings(): Promise<SellerSettings> {
    const settings = await SettingsRepository.getSettings();
    return settings || DEFAULT_SETTINGS;
  }

  public async updateSettings(newSettings: SellerSettings): Promise<boolean> {
    return await SettingsRepository.updateSettings(newSettings);
  }
}

export const settingsService = new SettingsService();
