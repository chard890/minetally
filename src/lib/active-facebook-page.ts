import { cookies } from 'next/headers';

export const ACTIVE_FACEBOOK_PAGE_COOKIE = 'active_facebook_page_id';
export const KNOWN_FACEBOOK_PAGES_COOKIE = 'known_facebook_page_ids';

function normalizeKnownPageIds(value: string | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .filter((entry, index, values) => values.indexOf(entry) === index);
  } catch {
    return [];
  }
}

async function setKnownFacebookPageDbIds(ids: string[]) {
  const cookieStore = await cookies();
  cookieStore.set(KNOWN_FACEBOOK_PAGES_COOKIE, JSON.stringify(ids), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

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

export async function getKnownFacebookPageDbIds() {
  const cookieStore = await cookies();
  return normalizeKnownPageIds(cookieStore.get(KNOWN_FACEBOOK_PAGES_COOKIE)?.value);
}

export async function addKnownFacebookPageDbId(pageId: string) {
  const currentIds = await getKnownFacebookPageDbIds();
  if (currentIds.includes(pageId)) {
    return;
  }

  await setKnownFacebookPageDbIds([...currentIds, pageId]);
}

export async function removeKnownFacebookPageDbId(pageId: string) {
  const currentIds = await getKnownFacebookPageDbIds();
  const nextIds = currentIds.filter((id) => id !== pageId);
  const cookieStore = await cookies();

  if (nextIds.length === 0) {
    cookieStore.delete(KNOWN_FACEBOOK_PAGES_COOKIE);
    return;
  }

  await setKnownFacebookPageDbIds(nextIds);
}
