'use client';

import { Activity, CheckCircle2, AlertCircle, RefreshCw, Info, LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/format';

interface SyncDiagnosticsProps {
  totalPosts?: number;
  totalItems?: number;
  totalComments?: number;
  totalErrors?: number;
  totalNeedsReview?: number;
  lastSyncedAt?: string;
  syncStatus: 'synced' | 'syncing' | 'error' | 'not_synced' | 'partial';
  error?: string | null;
}

export function SyncDiagnostics({
  totalPosts = 0,
  totalItems = 0,
  totalComments = 0,
  totalErrors = 0,
  totalNeedsReview = 0,
  lastSyncedAt,
  syncStatus,
  error
}: SyncDiagnosticsProps) {
  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-100 overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 text-indigo-500" />
            <CardTitle className="text-sm font-bold">Sync Diagnostics</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
             <SyncStatusBadge status={syncStatus} />
             {lastSyncedAt && (
               <span className="text-[10px] text-slate-400 font-medium">
                 {formatDateTime(lastSyncedAt)}
               </span>
             )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DiagnosticStat label="Posts Sync" value={totalPosts} icon={Info} color="blue" />
          <DiagnosticStat label="Items Sync" value={totalItems} icon={CheckCircle2} color="green" />
          <DiagnosticStat label="Comments" value={totalComments} icon={Activity} color="blue" />
          <DiagnosticStat label="Needs Review" value={totalNeedsReview} icon={AlertCircle} color="amber" />
          <DiagnosticStat label="Sync Errors" value={totalErrors} icon={AlertCircle} color="red" />
        </div>
        
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-red-700">Recent Sync Error</p>
              <p className="text-[11px] text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DiagnosticStat({ label, value, icon: Icon, color }: { label: string, value: number, icon: LucideIcon, color: 'blue' | 'green' | 'amber' | 'red' }) {
  const colors = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50'
  };

  return (
    <div className="p-3 rounded-2xl border border-slate-100 bg-slate-50/30">
      <div className="flex items-center space-x-2 mb-1">
        <div className={`p-1 rounded-md ${colors[color]}`}>
          <Icon className="h-3 w-3" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <p className="text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export function SyncStatusBadge({ status }: { status: SyncDiagnosticsProps['syncStatus'] }) {
  const configs = {
    synced: { label: 'Synced', icon: CheckCircle2, class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    syncing: { label: 'Syncing', icon: RefreshCw, class: 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse' },
    error: { label: 'Error', icon: AlertCircle, class: 'bg-red-100 text-red-700 border-red-200' },
    not_synced: { label: 'Not Synced', icon: Info, class: 'bg-slate-100 text-slate-600 border-slate-200' },
    partial: { label: 'Partial', icon: RefreshCw, class: 'bg-amber-100 text-amber-700 border-amber-200' }
  };

  const config = configs[status] || configs.not_synced;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${config.class}`}>
      <Icon className={`h-3 w-3 mr-1 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}
