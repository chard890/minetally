'use client';

import { MessageSquareMore } from 'lucide-react';
import { useState, useTransition } from 'react';
import { syncAllCollectionBatchCommentsAction } from '@/actions/collection.actions';
import { Button } from '@/components/ui/Button';
import { Toast, ToastType } from '@/components/ui/Toast';

interface SyncAllBatchCommentsButtonProps {
  collectionId: string;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Bulk comment sync failed. Check diagnostics for details.';
}

export function SyncAllBatchCommentsButton({ collectionId }: SyncAllBatchCommentsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const handleSync = () => {
    startTransition(async () => {
      try {
        const result = await syncAllCollectionBatchCommentsAction(collectionId);

        if (!result.success) {
          setToast({
            message: result.error || 'Bulk comment sync failed. Check diagnostics for details.',
            type: 'error',
          });
          return;
        }

        setToast({
          message: `Synced ${result.batchesSynced} batches and detected ${result.winnersCount} winners.`,
          type: 'success',
        });
      } catch (error) {
        setToast({
          message: getErrorMessage(error),
          type: 'error',
        });
      }
    });
  };

  return (
    <>
      <Button
        variant="outline"
        className="rounded-xl font-bold border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
        disabled={isPending}
        onClick={handleSync}
      >
        <MessageSquareMore className={`mr-2 h-4 w-4 ${isPending ? 'animate-pulse' : ''}`} />
        {isPending ? 'Syncing Batch Comments...' : 'Sync All Batch Comments'}
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
