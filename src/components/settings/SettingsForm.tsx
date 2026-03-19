'use client';

import {
  Save,
  Tag,
  Zap,
  AlertTriangle,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useState, useTransition } from 'react';
import { 
  updateSettingsAction,
} from '@/actions/workflow';
import {
  disconnectFacebookPageAction,
  finalizeFacebookPageSelectionAction,
  refreshFacebookConnectionAction,
} from '@/actions/facebook.actions';
import type { SellerSettings, MetaPage } from '@/types';
import { FacebookConnection } from './FacebookConnection';
import type { PendingFacebookConnectionSession } from '@/repositories/facebook-connection-session.repository';

interface SettingsFormProps {
  initialSettings: SellerSettings;
  initialConnectedPage: MetaPage | null;
  pendingFacebookConnection: PendingFacebookConnectionSession | null;
  facebookAuthConfigured: boolean;
  facebookError: string | null;
  facebookStatus: string | null;
}

export function SettingsForm({
  initialSettings,
  initialConnectedPage,
  pendingFacebookConnection,
  facebookAuthConfigured,
  facebookError,
  facebookStatus,
}: SettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState<SellerSettings>(initialSettings);

  const handleSave = () => {
    startTransition(async () => {
      await updateSettingsAction(settings);
      alert("Settings saved successfully!");
    });
  };

  const togglePref = (key: keyof SellerSettings['syncPreferences']) => {
    setSettings(prev => ({
      ...prev,
      syncPreferences: {
        ...prev.syncPreferences,
        [key]: !prev.syncPreferences[key]
      }
    }));
  };

  const toggleBehavior = (key: keyof SellerSettings['finalizationBehavior']) => {
    setSettings(prev => ({
      ...prev,
      finalizationBehavior: {
        ...prev.finalizationBehavior,
        [key]: !prev.finalizationBehavior[key]
      }
    }));
  };

  return (
    <div className="grid gap-8">
      <div className="flex justify-end">
        <Button 
          className="bg-indigo-600 shadow-lg shadow-indigo-100 ring-1 ring-indigo-500/20 px-8"
          onClick={handleSave}
          disabled={isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Facebook Integration (POC) */}
      <FacebookConnection 
        initialPage={initialConnectedPage} 
        pendingConnection={pendingFacebookConnection}
        authConfigured={facebookAuthConfigured}
        flashError={facebookError}
        flashStatus={facebookStatus}
        onSelectPage={async (sessionId, pageId) => {
          return await finalizeFacebookPageSelectionAction(sessionId, pageId);
        }}
        onRefresh={async () => {
          return await refreshFacebookConnectionAction();
        }}
        onDisconnect={async () => {
          await disconnectFacebookPageAction();
        }}
      />

      {/* Claim Keywords */}
      <div className="grid gap-8 md:grid-cols-2">
        <Card className="border-0 shadow-sm ring-1 ring-slate-100 flex flex-col">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <Tag className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Claim Rules</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 flex-1 space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Valid Claim Keywords</label>
              <div className="flex flex-wrap gap-2">
                {settings.validClaimKeywords.map(keyword => (
                  <span key={keyword} className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-sm font-bold">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Claim Code Mapping</label>
              <div className="grid gap-2">
                {Object.entries(settings.claimCodeMapping).map(([code, word]) => (
                  <div key={code} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-sm font-black text-slate-900 w-8">{code}</span>
                    <ArrowRight className="h-3 w-3 text-slate-300" />
                    <span className="text-sm font-bold text-slate-600 text-right flex-1">{word}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-slate-100 flex flex-col">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Cancellation Rules</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 flex-1 space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Cancel Keywords</label>
              <div className="flex flex-wrap gap-2">
                {settings.cancelKeywords.map(keyword => (
                  <span key={keyword} className="px-3 py-1.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-xl text-sm font-bold">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync & Finalization */}
      <div className="grid gap-8 md:grid-cols-2">
        <Card className="border-0 shadow-sm ring-1 ring-slate-100">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <Zap className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Sync Preferences</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Sync Photos First</p>
                <p className="text-xs text-slate-500">Ensure all photos are imported before scanning comments.</p>
              </div>
              <ToggleButton enabled={settings.syncPreferences.syncPhotosFirst} onClick={() => togglePref('syncPhotosFirst')} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Post-Import Sync</p>
                <p className="text-xs text-slate-500">Trigger comment scan immediately after batch import.</p>
              </div>
              <ToggleButton enabled={settings.syncPreferences.syncCommentsAfterImport} onClick={() => togglePref('syncCommentsAfterImport')} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Thumbnail Verification</p>
                 <p className="text-xs text-slate-500">Require seller to click &apos;Verify&apos; on new batch photos.</p>
              </div>
              <ToggleButton enabled={settings.syncPreferences.requireThumbnailVerification} onClick={() => togglePref('requireThumbnailVerification')} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-slate-100">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-200 text-slate-600 rounded-lg">
                <Lock className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Finalization Behavior</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Auto-Reassign</p>
                <p className="text-xs text-slate-500">Reassign winner to next claimant if first one cancels.</p>
              </div>
              <ToggleButton enabled={settings.finalizationBehavior.autoReassignOnCancel} onClick={() => toggleBehavior('autoReassignOnCancel')} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Lock on Finalize</p>
                <p className="text-xs text-slate-500">Prevent any data changes once collection is finalized.</p>
              </div>
              <ToggleButton enabled={settings.finalizationBehavior.lockCollectionOnFinalize} onClick={() => toggleBehavior('lockCollectionOnFinalize')} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Force Review</p>
                <p className="text-xs text-slate-500">Block finalization if unresolved items exist.</p>
              </div>
              <ToggleButton enabled={settings.finalizationBehavior.requireReviewBeforeFinalize} onClick={() => toggleBehavior('requireReviewBeforeFinalize')} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ToggleButton({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return (
    <div 
      className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${enabled ? 'bg-indigo-600' : 'bg-slate-200'} relative`}
      onClick={onClick}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${enabled ? 'left-6' : 'left-1'}`} />
    </div>
  );
}
