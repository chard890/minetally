'use server';

import { revalidatePath } from 'next/cache';
import { FacebookConnectionSessionRepository } from '@/repositories/facebook-connection-session.repository';
import { FacebookPageRepository } from '@/repositories/facebook-page.repository';
import { MetaPageService } from '@/services/meta/meta-graph.service';
import { persistFacebookPageConnection } from '@/lib/facebook-connection';
import { AuditLogRepository } from '@/repositories/audit-log.repository';

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

    revalidatePath('/settings');
    revalidatePath('/collections/new');

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to connect the selected Facebook Page.',
    };
  }
}

export async function disconnectFacebookPageAction() {
  const success = await FacebookPageRepository.disconnectPage();
  if (!success) {
    throw new Error('Failed to disconnect Facebook Page.');
  }

  await AuditLogRepository.log({
    action: 'facebook_disconnected',
  });

  revalidatePath('/settings');
  revalidatePath('/collections/new');
}

export async function refreshFacebookConnectionAction() {
  const page = await FacebookPageRepository.getConnectedPage();
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
      return { error: 'Facebook rejected the stored Page Access Token. Reconnect your page.' };
    }

    await FacebookPageRepository.markSyncSuccess(page.id);
    revalidatePath('/settings');

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
    return { error: message };
  }
}
