'use client';

import { MessageSquareMore } from 'lucide-react';
import { useState, useTransition } from 'react';
import { syncAllCollectionBatchCommentsAction } from '@/actions/collection.actions';
import { Button } from '@/components/ui/Button';
import { Toast, ToastType } from '@/components/ui/Toast';
import { ActionLoadingOverlay } from '@/components/ui/ActionLoadingOverlay';

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
      <ActionLoadingOverlay
        visible={isPending}
        title="Syncing batch comments"
        description="MineTally is scanning every batch in this collection, resolving confirmed buyers, and updating the latest totals."
      />

      <Button
        variant="outline"
        className="text-[#4f4a57]"
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
