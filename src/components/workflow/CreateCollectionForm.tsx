'use client';

import { Calendar, Facebook, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useState, useTransition } from "react";
import { createCollectionAction } from "@/actions/workflow";
import { useRouter } from "next/navigation";
import { Toast, type ToastType } from "@/components/ui/Toast";

interface CreateCollectionFormProps {
  pages: { id: string; name: string }[];
  activePageId: string | null;
}

export function CreateCollectionForm({ pages, activePageId }: CreateCollectionFormProps) {
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
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-[0.22em] text-[#8b8594]">Collection Name</label>
          <input 
            name="name"
            type="text" 
            placeholder="e.g. March 15 to 16 Payday Drop" 
            className="h-11 w-full px-4 text-[15px] font-medium sm:h-12 sm:text-base"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 sm:gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-[0.22em] text-[#8b8594]">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b8594] sm:left-4" />
              <input 
                name="startDate"
                type="date" 
                className="h-11 w-full pl-11 pr-4 text-[15px] font-medium sm:h-12 sm:pl-12 sm:text-base"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-[0.22em] text-[#8b8594]">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b8594] sm:left-4" />
              <input 
                name="endDate"
                type="date" 
                className="h-11 w-full pl-11 pr-4 text-[15px] font-medium sm:h-12 sm:pl-12 sm:text-base"
                required
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-[0.22em] text-[#8b8594]">Connected Facebook Page</label>
          <div className="relative">
            <Facebook className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 sm:left-4" />
            <select
              name="pageId"
              className="h-11 w-full appearance-none bg-transparent pl-11 pr-4 text-[15px] font-bold sm:h-12 sm:pl-12 sm:text-base"
              defaultValue={activePageId ?? ''}
              required
            >
              <option value="">Select a page...</option>
              {pages.map(page => (
                <option key={page.id} value={page.id}>{page.name}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-[#6b6b6b]">Comments will be synced from this page only.</p>
        </div>

        {syncStatus && (
          <div
            className="flex items-center rounded-[18px] border border-[#dccdfb] bg-[#f3edff] p-3 sm:p-4"
            aria-live="polite"
          >
            <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-[#7a62b7] shadow-[0_8px_20px_rgba(122,98,183,0.12)] sm:h-9 sm:w-9">
              <RefreshCw className="h-4 w-4 animate-spin" />
            </div>
            <p className="text-[13px] font-bold text-[#7a62b7] sm:text-sm">{syncStatus}</p>
          </div>
        )}
        
        <div className="pt-2 sm:pt-4">
          <Button 
            type="submit"
            className="h-12 w-full text-base font-black sm:h-14 sm:text-lg"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                {syncStatus || 'Processing...'}
              </>
            ) : 'Create Collection and Start Import'}
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
