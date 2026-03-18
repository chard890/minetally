'use client';

import { Facebook, CheckCircle2, XCircle, RefreshCw, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useState, useTransition } from 'react';
import { formatDateTime } from '@/lib/format';
import { MetaPage } from '@/types';

interface FacebookConnectionProps {
  initialPage?: MetaPage | null;
  onConnect: (token: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function FacebookConnection({ initialPage, onConnect, onDisconnect }: FacebookConnectionProps) {
  const [isPending, startTransition] = useTransition();
  const [debugToken, setDebugToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleConnect = () => {
    if (!debugToken) return;
    setError(null);
    startTransition(async () => {
      try {
        await onConnect(debugToken);
        setDebugToken('');
      } catch (err) {
        setError('Failed to connect. Please verify your token.');
      }
    });
  };

  const handleDisconnect = () => {
    if (!confirm('Are you sure you want to disconnect this Facebook Page?')) return;
    startTransition(async () => {
      await onDisconnect();
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
            <CardTitle className="text-lg">Facebook Connection (POC)</CardTitle>
            <CardDescription>Connect a real Facebook Page for live selling synchronization.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {initialPage ? (
          <div className="flex items-center justify-between p-5 rounded-2xl border border-blue-100 bg-blue-50/20">
            <div className="flex items-center space-x-4">
              <div className="h-14 w-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <p className="font-black text-slate-900 text-lg">{initialPage.name}</p>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-full">Active</span>
                </div>
                <p className="text-xs text-slate-500 font-medium">Page ID: {initialPage.id}</p>
                <p className="text-[10px] text-slate-400 mt-1 italic italic">Connected with user token, syncing with stored page token.</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl font-bold border-slate-200 hover:bg-white"
                onClick={() => {}} // Could trigger a re-validation
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
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
                Enter a Meta User Access Token below. MineTally will derive and store the Page Access Token automatically.
              </p>
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">User Access Token</label>
              <div className="flex space-x-2">
                <input 
                  type="password"
                  placeholder="Paste your user access token..."
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={debugToken}
                  onChange={(e) => setDebugToken(e.target.value)}
                />
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-100 px-6"
                  onClick={handleConnect}
                  disabled={isPending || !debugToken}
                >
                  {isPending ? "Connecting..." : "Connect"}
                </Button>
              </div>
              {error && <p className="text-xs text-red-500 font-bold mt-1 inline-flex items-center"><XCircle className="h-3 w-3 mr-1" /> {error}</p>}
              <p className="text-[10px] text-slate-400 italic">
                * Note: Use a User Access Token that can return a Page token via `/me/accounts` with `pages_read_engagement`, `pages_show_list`, and `pages_read_user_content`.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
