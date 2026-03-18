import { supabase } from '@/lib/supabase';
import { SellerSettings } from '@/types';
import { SellerSettingsSchema } from '@/lib/schema';

export class SettingsRepository {
  /**
   * Fetches the global settings. 
   * For the simulation, we assume there's only one settings row (id: 'global').
   */
  static async getSettings(): Promise<SellerSettings | null> {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings:', error);
      return null;
    }

    if (!data) return null;

    // Fetch connected page info if available
    const { data: pageData } = await supabase
      .from('facebook_pages')
      .select('page_name, token_expires_at, token_status, connection_status')
      .limit(1)
      .maybeSingle();

    let isTokenExpired = false;
    if (pageData?.token_expires_at) {
      const expiry = new Date(pageData.token_expires_at);
      isTokenExpired = expiry.getTime() < Date.now();
    }

    // Map DB JSONB fields to SellerSettings object
    return {
      validClaimKeywords: data.valid_claim_keywords_json,
      cancelKeywords: data.cancel_keywords_json,
      claimCodeMapping: data.claim_code_mapping_json,
      syncPreferences: data.sync_preferences_json,
      finalizationBehavior: data.finalization_behavior_json,
      facebookIntegration: {
        connectedPageName: pageData?.page_name ?? "Ukay Queen",
        connectedSince: data.created_at ?? '',
        syncIntervalLabel: "Every 5 minutes",
        autoSyncComments: true,
        importOnlyCollectionDateRange: true,
        isTokenExpired: isTokenExpired || pageData?.token_status === 'invalid' || pageData?.connection_status === 'needs_reconnect',
      }
    };
  }

  static async updateSettings(settings: SellerSettings): Promise<boolean> {
    // Validate with Zod
    SellerSettingsSchema.parse(settings);

    const { error } = await supabase
      .from('settings')
      .upsert({
        id: 'global', // Constant ID for the single settings row
        valid_claim_keywords_json: settings.validClaimKeywords,
        cancel_keywords_json: settings.cancelKeywords,
        claim_code_mapping_json: settings.claimCodeMapping,
        sync_preferences_json: settings.syncPreferences,
        finalization_behavior_json: settings.finalizationBehavior,
      });

    if (error) {
      console.error('Error updating settings:', error);
      return false;
    }

    return true;
  }
}
