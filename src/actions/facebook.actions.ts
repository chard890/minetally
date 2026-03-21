'use server';

import { revalidatePath } from 'next/cache';
import { FacebookConnectionSessionRepository } from '@/repositories/facebook-connection-session.repository';
import { FacebookPageRepository } from '@/repositories/facebook-page.repository';
import { MetaPageService } from '@/services/meta/meta-graph.service';
import { persistFacebookPageConnection } from '@/lib/facebook-connection';
import { AuditLogRepository } from '@/repositories/audit-log.repository';
import {
  addKnownFacebookPageDbId,
  clearActiveFacebookPageDbId,
  getKnownFacebookPageDbIds,
  removeKnownFacebookPageDbId,
  setActiveFacebookPageDbId,
} from '@/lib/active-facebook-page';

export async function finalizeFacebookPageSelectionAction(sessionId: string, pageId: string) {
  const session = await FacebookConnectionSessionRepository.consumeSession(sessionId);
  if (!session) {
    return { error: 'Your Facebook connection session expired. Please connect again.' };
  }

  const selectedPage = session.pages.find((page) => page.id === pageId);
  if (!selectedPage) {
    return { error: 'The selected Facebook Page was not found in this session.' };
  }

  try {
    await persistFacebookPageConnection({
      page: {
        id: selectedPage.id,
        name: selectedPage.name,
        access_token: selectedPage.accessToken,
        tasks: selectedPage.tasks,
      },
      facebookUserId: session.facebookUserId,
      userAccessToken: session.userAccessToken,
    });

    const storedPage = await FacebookPageRepository.getPageByMetaPageId(selectedPage.id);
    if (storedPage) {
      await addKnownFacebookPageDbId(storedPage.id);
      await setActiveFacebookPageDbId(storedPage.id);
    }

    revalidatePath('/settings');
    revalidatePath('/');
    revalidatePath('/collections/new');

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to connect the selected Facebook Page.',
    };
  }
}

export async function selectActiveFacebookPageAction(pageId: string) {
  const knownPageIds = await getKnownFacebookPageDbIds();
  if (!knownPageIds.includes(pageId)) {
    return { error: 'That Facebook Page is not available in this browser.' };
  }

  const selectedPage = await FacebookPageRepository.getPageById(pageId);
  if (!selectedPage) {
    return { error: 'That Facebook Page is no longer available.' };
  }

  await setActiveFacebookPageDbId(pageId);
  revalidatePath('/');
  revalidatePath('/settings');
  revalidatePath('/collections/new');

  return { success: true };
}

export async function disconnectFacebookPageAction(pageId?: string) {
  const success = pageId
    ? await FacebookPageRepository.disconnectPageById(pageId)
    : await FacebookPageRepository.disconnectPage();
  if (!success) {
    throw new Error('Failed to disconnect Facebook Page.');
  }

  if (pageId) {
    await removeKnownFacebookPageDbId(pageId);
    await clearActiveFacebookPageDbId();
  }

  await AuditLogRepository.log({
    action: 'facebook_disconnected',
  });

  revalidatePath('/settings');
  revalidatePath('/');
  revalidatePath('/collections/new');
}

export async function refreshFacebookConnectionAction(pageId?: string) {
  const page = pageId
    ? await FacebookPageRepository.getPageById(pageId)
    : await FacebookPageRepository.getConnectedPage();
  if (!page) {
    return { error: 'No connected Facebook Page found.' };
  }

  try {
    const validatedPage = await MetaPageService.getPageDetails(page.id, page.access_token);
    if (!validatedPage) {
      await FacebookPageRepository.markPageTokenStatus({
        pageId: page.id,
        tokenStatus: 'invalid',
        connectionStatus: 'needs_reconnect',
        lastSyncError: 'Facebook rejected the stored Page Access Token.',
      });

      revalidatePath('/settings');
      revalidatePath('/');
      return { error: 'Facebook rejected the stored Page Access Token. Reconnect your page.' };
    }

    await FacebookPageRepository.markSyncSuccess(page.id);
    revalidatePath('/settings');
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to validate the Facebook connection.';
    await FacebookPageRepository.markPageTokenStatus({
      pageId: page.id,
      tokenStatus: 'invalid',
      connectionStatus: 'needs_reconnect',
      lastSyncError: message,
    });
    revalidatePath('/settings');
    revalidatePath('/');
    return { error: message };
  }
}
