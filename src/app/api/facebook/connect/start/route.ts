import { NextRequest, NextResponse } from 'next/server';
import {
  buildFacebookCallbackUrl,
  buildFacebookOauthUrl,
  generateOauthState,
  isFacebookAuthConfigured,
} from '@/lib/facebook-auth';

const FACEBOOK_OAUTH_STATE_COOKIE = 'facebook_oauth_state';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  if (!isFacebookAuthConfigured()) {
    return NextResponse.redirect(
      new URL('/settings?facebook_error=Facebook+OAuth+is+not+configured.', url.origin),
    );
  }

  const state = generateOauthState();
  const redirectUrl = buildFacebookOauthUrl({
    redirectUri: buildFacebookCallbackUrl(url.origin),
    state,
  });

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(FACEBOOK_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    path: '/',
    maxAge: 60 * 10,
  });

  return response;
}
