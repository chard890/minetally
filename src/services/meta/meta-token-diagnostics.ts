import { appendSyncDiagnostic, appendSyncTrace } from '@/lib/sync-diagnostics';

export type MetaTokenInspection = {
  appId: string | null;
  type: string | null;
  isValid: boolean | null;
  scopes: string[];
  granularScopes: Array<{
    scope: string;
    targetIds: string[];
  }>;
};

const tokenInspectionCache = new Map<string, Promise<MetaTokenInspection | null>>();

function getAppAccessToken() {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();

  if (!appId || !appSecret) {
    return null;
  }

  return `${appId}|${appSecret}`;
}

export function maskToken(token: string) {
  if (token.length <= 10) {
    return `${token.slice(0, 2)}...${token.slice(-2)}`;
  }

  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

export async function inspectMetaAccessToken(accessToken: string) {
  const appAccessToken = getAppAccessToken();
  if (!appAccessToken) {
    appendSyncDiagnostic('[META_DEBUG] Skipping token inspection because FACEBOOK_APP_ID / FACEBOOK_APP_SECRET are not configured.\n');
    return null;
  }

  const cacheKey = maskToken(accessToken);
  const cachedInspection = tokenInspectionCache.get(cacheKey);
  if (cachedInspection) {
    return cachedInspection;
  }

  const pendingInspection = (async (): Promise<MetaTokenInspection | null> => {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appAccessToken)}`,
      );
      const payload = await response.json() as {
        data?: {
          app_id?: string;
          type?: string;
          is_valid?: boolean;
          scopes?: string[];
          granular_scopes?: Array<{
            scope?: string;
            target_ids?: string[];
          }>;
        };
        error?: {
          message?: string;
        };
      };

      if (!response.ok || !payload.data) {
        appendSyncDiagnostic(
          `[META_DEBUG] Token inspection failed for ${cacheKey}: ${payload.error?.message ?? response.statusText}\n`,
        );
        return null;
      }

      const inspection: MetaTokenInspection = {
        appId: payload.data.app_id ?? null,
        type: payload.data.type ?? null,
        isValid: typeof payload.data.is_valid === 'boolean' ? payload.data.is_valid : null,
        scopes: payload.data.scopes ?? [],
        granularScopes: (payload.data.granular_scopes ?? []).map((entry) => ({
          scope: entry.scope ?? 'unknown',
          targetIds: entry.target_ids ?? [],
        })),
      };

      appendSyncTrace('meta:token_inspection', {
        token: cacheKey,
        inspection,
      });
      return inspection;
    } catch (error) {
      appendSyncDiagnostic(
        `[META_DEBUG] Token inspection threw for ${cacheKey}: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
      );
      return null;
    }
  })();

  tokenInspectionCache.set(cacheKey, pendingInspection);
  return pendingInspection;
}
