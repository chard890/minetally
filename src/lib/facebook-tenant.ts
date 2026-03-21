import { cookies } from 'next/headers';

export const FACEBOOK_TENANT_COOKIE = 'facebook_tenant_id';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  };
}

export async function getFacebookTenantId() {
  const cookieStore = await cookies();
  const tenantId = cookieStore.get(FACEBOOK_TENANT_COOKIE)?.value?.trim();
  return tenantId ? tenantId : null;
}

export async function setFacebookTenantId(facebookUserId: string) {
  const nextTenantId = facebookUserId.trim();
  if (!nextTenantId) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(FACEBOOK_TENANT_COOKIE, nextTenantId, cookieOptions());
}

export async function clearFacebookTenantId() {
  const cookieStore = await cookies();
  cookieStore.delete(FACEBOOK_TENANT_COOKIE);
}

export function getFacebookTenantCookieOptions() {
  return cookieOptions();
}
