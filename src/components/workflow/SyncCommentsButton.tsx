'use client';

import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useState, useTransition } from 'react';
import { syncBatchCommentsAction } from '@/actions/collection.actions';
import { Toast, ToastType } from '@/components/ui/Toast';

interface SyncCommentsButtonProps {
  collectionId: string;
  batchId: string;
}

export function SyncCommentsButton({ collectionId, batchId }: SyncCommentsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "An unexpected error occurred during comment sync.";

  const handleSync = () => {
    startTransition(async () => {
      try {
        const result = await syncBatchCommentsAction(batchId);
        if (result.success) {
          setToast({ 
            message: `Comment sync complete! Detected ${result.winnersCount} winners.`, 
            type: 'success' 
          });
        } else {
          setToast({ 
            message: result.error || "Comment sync failed. Check diagnostics for details.", 
            type: 'error' 
          });
        }
      } catch (error) {
        setToast({ 
          message: getErrorMessage(error), 
          type: 'error' 
        });
      }
    });
  };

  return (
    <>
      <Button 
        className="rounded-xl bg-indigo-600 font-bold hover:bg-indigo-700 text-white disabled:opacity-70"
        disabled={isPending}
        onClick={handleSync}
      >
        <MessageSquare className={`h-4 w-4 mr-2 ${isPending ? 'animate-pulse' : ''}`} />
        {isPending ? "Syncing Comments..." : "Sync Comments"}
      </Button>

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
