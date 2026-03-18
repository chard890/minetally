'use client';

import { Calendar, Facebook } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useState, useTransition } from "react";
import { createCollectionAction } from "@/actions/workflow";
import { useRouter } from "next/navigation";
import { Toast, type ToastType } from "@/components/ui/Toast";

interface CreateCollectionFormProps {
  pages: { id: string; name: string }[];
}

export function CreateCollectionForm({ pages }: CreateCollectionFormProps) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    startTransition(async () => {
      setSyncStatus('Creating collection...');
      const result = await createCollectionAction(formData);
      
      if (result.success && result.id) {
        setSyncStatus('Syncing Facebook posts...');
        // We call the full sync action here
        const { fullCollectionSyncAction } = await import('@/actions/collection.actions');
        
        setSyncStatus('Importing items and detecting winners...');
        const syncResult = await fullCollectionSyncAction(result.id);
        
        if (syncResult.success) {
          setSyncStatus('Sync complete!');
          setToast({ message: `Collection created and ${syncResult.winnersCount} winners detected!`, type: 'success' });
        } else {
          setToast({ message: 'Collection created, but automatic sync had issues. You can retry manually.', type: 'error' });
        }
        
        // Small delay to let the toast be seen
        setTimeout(() => {
          router.push(`/collections/${result.id}`);
        }, 1500);
      } else {
        setSyncStatus(null);
        setToast({ message: result.error || 'Failed to create collection.', type: 'error' });
      }
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-slate-400">Collection Name</label>
          <input 
            name="name"
            type="text" 
            placeholder="e.g. March 15 to 16 Payday Drop" 
            className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            required
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                name="startDate"
                type="date" 
                className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                name="endDate"
                type="date" 
                className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                required
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-slate-400">Connected Facebook Page</label>
          <div className="relative">
            <Facebook className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
            <select name="pageId" className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold bg-white appearance-none" required>
              <option value="">Select a page...</option>
              {pages.map(page => (
                <option key={page.id} value={page.id}>{page.name}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500">Comments will be synced from this page only.</p>
        </div>

        {syncStatus && (
          <div className="rounded-xl bg-indigo-50 p-4 border border-indigo-100 flex items-center animate-pulse">
            <div className="h-2 w-2 rounded-full bg-indigo-600 mr-3"></div>
            <p className="text-sm font-bold text-indigo-700">{syncStatus}</p>
          </div>
        )}
        
        <div className="pt-4">
          <Button 
            type="submit"
            className="w-full h-14 rounded-2xl bg-indigo-600 text-lg font-black shadow-lg shadow-indigo-100"
            disabled={isPending}
          >
            {isPending ? (syncStatus || 'Processing...') : 'Create Collection and Start Import'}
          </Button>
        </div>
      </form>

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </>
  );
}

