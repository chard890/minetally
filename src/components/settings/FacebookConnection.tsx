'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Facebook,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Unlink,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/format';
import type { MetaPage } from '@/types';
import type { PendingFacebookConnectionSession } from '@/repositories/facebook-connection-session.repository';

interface FacebookConnectionProps {
  initialPage?: MetaPage | null;
  pendingConnection: PendingFacebookConnectionSession | null;
  authConfigured: boolean;
  flashError: string | null;
  flashStatus: string | null;
  onSelectPage: (sessionId: string, pageId: string) => Promise<{ success?: boolean; error?: string }>;
  onRefresh: () => Promise<{ success?: boolean; error?: string }>;
  onDisconnect: () => Promise<void>;
}

export function FacebookConnection({
  initialPage,
  pendingConnection,
  authConfigured,
  flashError,
  flashStatus,
  onSelectPage,
  onRefresh,
  onDisconnect,
}: FacebookConnectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(flashError);
  const [selectedPageId, setSelectedPageId] = useState<string>(pendingConnection?.pages[0]?.id ?? '');

  const needsReconnect = initialPage?.connection_status === 'needs_reconnect' || initialPage?.reconnect_required;
  const connectedStatusLabel = needsReconnect ? 'Reconnect Required' : 'Connected';
  const connectHref = '/api/facebook/connect/start';
  const statusMessage = useMemo(() => {
    if (flashStatus === 'connected') {
      return 'Facebook Page connected successfully.';
    }
    if (flashStatus === 'select_page') {
      return 'Choose which Facebook Page MineTally should use for syncing.';
    }
    return null;
  }, [flashStatus]);

  const handleSelectPage = () => {
    if (!pendingConnection || !selectedPageId) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await onSelectPage(pendingConnection.id, selectedPageId);
      if (result.error) {
        setError(result.error);
        return;
      }

      router.replace('/settings?facebook_status=connected');
      router.refresh();
    });
  };

  const handleRefresh = () => {
    setError(null);
    startTransition(async () => {
      const result = await onRefresh();
      if (result.error) {
        setError(result.error);
      } else {
        router.replace('/settings');
        router.refresh();
      }
    });
  };

  const handleStartConnect = () => {
    if (!authConfigured || isPending) {
      return;
    }

    window.location.href = connectHref;
  };

  const handleDisconnect = () => {
    if (!confirm('Are you sure you want to disconnect this Facebook Page?')) return;
    startTransition(async () => {
      await onDisconnect();
      router.replace('/settings');
      router.refresh();
    });
  };

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-100 overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <Facebook className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Facebook Connection</CardTitle>
            <CardDescription>Authorize MineTally, choose your Page, and sync with the stored Page Access Token.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {statusMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm font-medium text-emerald-700">
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-sm font-medium text-rose-700">
            <span className="inline-flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              {error}
            </span>
          </div>
        )}

        {!authConfigured && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm font-medium text-amber-800">
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Configure `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, and `TOKEN_ENCRYPTION_SECRET` before using Facebook connect.
            </span>
          </div>
        )}

        {pendingConnection && (
          <div className="space-y-4 rounded-[24px] border border-indigo-100 bg-indigo-50/40 p-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">Choose Page</p>
              <h3 className="mt-2 text-lg font-black text-slate-900">Select the Facebook Page MineTally should sync.</h3>
              <p className="mt-1 text-sm text-slate-500">
                MineTally found {pendingConnection.pages.length} Pages on your account. The selected Page Access Token will be stored for future sync jobs.
              </p>
            </div>

            <div className="grid gap-3">
              {pendingConnection.pages.map((page) => (
                <label
                  key={page.id}
                  className={`flex cursor-pointer items-start justify-between gap-4 rounded-2xl border p-4 transition-colors ${
                    selectedPageId === page.id
                      ? 'border-indigo-300 bg-white text-slate-900'
                      : 'border-white/70 bg-white/60 text-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="facebook-page-selection"
                      className="mt-1"
                      checked={selectedPageId === page.id}
                      onChange={() => setSelectedPageId(page.id)}
                    />
                    <div>
                      <p className="font-bold">{page.name}</p>
                      <p className="mt-1 text-xs text-slate-500">Page ID: {page.id}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Tasks: {(page.tasks?.length ? page.tasks.join(', ') : 'Not returned by Facebook')}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-indigo-400" />
                </label>
              ))}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSelectPage} disabled={isPending || !selectedPageId}>
                {isPending ? 'Saving Page...' : 'Use Selected Page'}
              </Button>
            </div>
          </div>
        )}

        {initialPage ? (
          <div className="flex items-center justify-between p-5 rounded-2xl border border-blue-100 bg-blue-50/20">
            <div className="flex items-center space-x-4">
              <div className="h-14 w-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                {needsReconnect ? <AlertTriangle className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <p className="font-black text-slate-900 text-lg">{initialPage.name}</p>
                  <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-full ${
                    needsReconnect ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {connectedStatusLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">Page ID: {initialPage.id}</p>
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  Sync jobs use the stored Page Access Token. User token is only kept for reconnect support.
                </p>
                {initialPage.token_last_validated_at && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Last validated: {formatDateTime(initialPage.token_last_validated_at)}
                  </p>
                )}
                {initialPage.last_sync_error && (
                  <p className="mt-1 text-[11px] font-medium text-amber-700">
                    {initialPage.last_sync_error}
                  </p>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl font-bold border-slate-200 hover:bg-white"
                onClick={handleRefresh}
                disabled={isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
                {needsReconnect ? 'Reconnect Check' : 'Refresh'}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl font-bold border-slate-200 hover:bg-white"
                disabled={!authConfigured || isPending}
                onClick={handleStartConnect}
              >
                <Facebook className="h-4 w-4 mr-2" />
                {needsReconnect ? 'Reconnect' : 'Connect Different Page'}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="rounded-xl font-bold text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={handleDisconnect}
                disabled={isPending}
              >
                <Unlink className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/30">
              <p className="text-sm font-medium text-amber-800 flex items-center">
                <Facebook className="h-4 w-4 mr-2" />
                No Page Connected
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Connect with Facebook, approve the required permissions, and choose the Page MineTally should use.
              </p>
            </div>
            <Button
              className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-100 px-6"
              disabled={!authConfigured || isPending}
              onClick={handleStartConnect}
            >
              <Facebook className="h-4 w-4 mr-2" />
              Connect with Facebook
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
