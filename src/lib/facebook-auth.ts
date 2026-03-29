import { randomUUID } from 'node:crypto';

const FACEBOOK_GRAPH_URL = 'https://graph.facebook.com/v19.0';

export const REQUIRED_FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_read_user_content',
  'pages_messaging',
  'pages_manage_metadata',
];

export function isFacebookAuthConfigured() {
  return Boolean(
    process.env.FACEBOOK_APP_ID?.trim()
    && process.env.FACEBOOK_APP_SECRET?.trim(),
  );
}

export function buildFacebookOauthUrl(params: {
  redirectUri: string;
  state: string;
}) {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  if (!appId) {
    throw new Error('FACEBOOK_APP_ID is not configured.');
  }

  const url = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set('scope', REQUIRED_FACEBOOK_SCOPES.join(','));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('auth_type', 'rerequest');

  return url.toString();
}

export function buildFacebookCallbackUrl(origin: string) {
  return `${origin}/api/facebook/connect/callback`;
}

export function generateOauthState() {
  return randomUUID();
}

export async function exchangeFacebookCodeForUserToken(params: {
  code: string;
  redirectUri: string;
}) {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();

  if (!appId || !appSecret) {
    throw new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be configured.');
  }

  const url = new URL(`${FACEBOOK_GRAPH_URL}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('code', params.code);

  const response = await fetch(url.toString(), { cache: 'no-store' });
  const payload = await response.json() as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error?.message || 'Failed to exchange Facebook authorization code.');
  }

  return {
    accessToken: payload.access_token,
    expiresIn: payload.expires_in,
  };
}

export async function fetchFacebookUserProfile(userAccessToken: string) {
  const url = new URL(`${FACEBOOK_GRAPH_URL}/me`);
  url.searchParams.set('fields', 'id,name');
  url.searchParams.set('access_token', userAccessToken);

  const response = await fetch(url.toString(), { cache: 'no-store' });
  const payload = await response.json() as {
    id?: string;
    name?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message || 'Failed to fetch Facebook user profile.');
  }

  return payload;
}
