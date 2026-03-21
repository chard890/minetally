import { cookies } from 'next/headers';

export const ACTIVE_FACEBOOK_PAGE_COOKIE = 'active_facebook_page_id';

export async function getActiveFacebookPageDbId() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_FACEBOOK_PAGE_COOKIE)?.value ?? null;
}

export async function setActiveFacebookPageDbId(pageId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_FACEBOOK_PAGE_COOKIE, pageId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearActiveFacebookPageDbId() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_FACEBOOK_PAGE_COOKIE);
}
