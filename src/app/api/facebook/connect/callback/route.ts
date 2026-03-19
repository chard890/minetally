import { NextRequest, NextResponse } from 'next/server';
import {
  REQUIRED_FACEBOOK_SCOPES,
  buildFacebookCallbackUrl,
  exchangeFacebookCodeForUserToken,
  fetchFacebookUserProfile,
  isFacebookAuthConfigured,
} from '@/lib/facebook-auth';
import { hasPreferredPageTasks, persistFacebookPageConnection } from '@/lib/facebook-connection';
import { FacebookConnectionSessionRepository } from '@/repositories/facebook-connection-session.repository';
import { MetaPageService } from '@/services/meta/meta-graph.service';
import { inspectMetaAccessToken } from '@/services/meta/meta-token-diagnostics';

const FACEBOOK_OAUTH_STATE_COOKIE = 'facebook_oauth_state';

function redirectToSettings(origin: string, params: Record<string, string>) {
  const url = new URL('/settings', origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const stateFromCookie = request.cookies.get(FACEBOOK_OAUTH_STATE_COOKIE)?.value;
  const stateFromQuery = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const errorReason = url.searchParams.get('error_reason');
  const errorDescription = url.searchParams.get('error_description');

  if (!isFacebookAuthConfigured()) {
    return redirectToSettings(url.origin, {
      facebook_error: 'Facebook OAuth is not configured.',
    });
  }

  if (errorReason) {
    return redirectToSettings(url.origin, {
      facebook_error: errorReason === 'user_denied'
        ? 'Facebook login was cancelled.'
        : (errorDescription || 'Facebook login failed.'),
    });
  }

  if (!code || !stateFromQuery || !stateFromCookie || stateFromCookie !== stateFromQuery) {
    return redirectToSettings(url.origin, {
      facebook_error: 'Facebook login could not be verified. Please try again.',
    });
  }

  try {
    const exchange = await exchangeFacebookCodeForUserToken({
      code,
      redirectUri: buildFacebookCallbackUrl(url.origin),
    });
    const tokenInspection = await inspectMetaAccessToken(exchange.accessToken);
    const grantedScopes = tokenInspection?.scopes ?? [];
    const missingScopes = REQUIRED_FACEBOOK_SCOPES.filter((scope) => !grantedScopes.includes(scope));

    if (missingScopes.length > 0) {
      return redirectToSettings(url.origin, {
        facebook_error: `Missing required Facebook permissions: ${missingScopes.join(', ')}`,
      });
    }

    const [profile, managedPages] = await Promise.all([
      fetchFacebookUserProfile(exchange.accessToken),
      MetaPageService.getManagedPages(exchange.accessToken),
    ]);

    const eligiblePages = managedPages.filter((page) => Boolean(page.access_token?.trim()));

    if (eligiblePages.length === 0) {
      return redirectToSettings(url.origin, {
        facebook_error: 'No Facebook Pages with Page Access Tokens were returned for this account.',
      });
    }

    const tokenExpiresAt = exchange.expiresIn
      ? new Date(Date.now() + exchange.expiresIn * 1000).toISOString()
      : undefined;

    if (eligiblePages.length === 1 && hasPreferredPageTasks(eligiblePages[0].tasks)) {
      await persistFacebookPageConnection({
        page: eligiblePages[0],
        facebookUserId: profile.id,
        userAccessToken: exchange.accessToken,
        tokenExpiresAt,
      });

      const response = redirectToSettings(url.origin, {
        facebook_status: 'connected',
      });
      response.cookies.delete(FACEBOOK_OAUTH_STATE_COOKIE);
      return response;
    }

    const sessionId = await FacebookConnectionSessionRepository.createSession({
      facebookUserId: profile.id,
      userAccessToken: exchange.accessToken,
      pages: eligiblePages,
      grantedScopes,
      requiredScopes: REQUIRED_FACEBOOK_SCOPES,
    });

    if (!sessionId) {
      return redirectToSettings(url.origin, {
        facebook_error: 'Failed to prepare Facebook Page selection.',
      });
    }

    const response = redirectToSettings(url.origin, {
      facebook_status: 'select_page',
      facebook_session: sessionId,
    });
    response.cookies.delete(FACEBOOK_OAUTH_STATE_COOKIE);
    return response;
  } catch (error) {
    const response = redirectToSettings(url.origin, {
      facebook_error: error instanceof Error ? error.message : 'Facebook connection failed.',
    });
    response.cookies.delete(FACEBOOK_OAUTH_STATE_COOKIE);
    return response;
  }
}
