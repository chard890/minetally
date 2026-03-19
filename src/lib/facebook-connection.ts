import { AuditLogRepository } from '@/repositories/audit-log.repository';
import { FacebookPageRepository } from '@/repositories/facebook-page.repository';
import { MetaPage } from '@/types';

export const PREFERRED_PAGE_TASKS = ['MODERATE', 'MANAGE'];

export function hasPreferredPageTasks(tasks: string[] | undefined) {
  if (!tasks || tasks.length === 0) {
    return true;
  }

  return PREFERRED_PAGE_TASKS.some((task) => tasks.includes(task));
}

export async function persistFacebookPageConnection(params: {
  page: MetaPage;
  facebookUserId?: string | null;
  userAccessToken: string;
  tokenExpiresAt?: string;
}) {
  if (!params.page.access_token?.trim()) {
    throw new Error('Selected Facebook Page has no page access token.');
  }

  if (!hasPreferredPageTasks(params.page.tasks)) {
    throw new Error('Selected Facebook Page is missing the required Page tasks.');
  }

  const success = await FacebookPageRepository.upsertPage({
    ...params.page,
    facebookUserId: params.facebookUserId ?? null,
    userAccessToken: params.userAccessToken,
    tokenStatus: 'valid',
    connectionStatus: 'active',
    reconnectRequired: false,
    lastSyncError: null,
  }, params.tokenExpiresAt);

  if (!success) {
    throw new Error('Failed to save Facebook Page connection.');
  }

  await AuditLogRepository.log({
    action: 'facebook_connected',
    details: {
      pageId: params.page.id,
      pageName: params.page.name,
      pageTasks: params.page.tasks ?? [],
      tokenTypeUsedForSync: 'page_access_token',
      storedPageAccessToken: true,
      facebookUserId: params.facebookUserId ?? null,
    },
  });
}
