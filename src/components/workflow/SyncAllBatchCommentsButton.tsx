'use client';

import { MessageSquareMore } from 'lucide-react';
import { useState, useTransition } from 'react';
import {
  finalizeCollectionBatchCommentSyncAction,
  getCollectionBatchSyncPlanAction,
  syncBatchCommentsAction,
} from '@/actions/collection.actions';
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
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null);

  const handleSync = () => {
    startTransition(async () => {
      try {
        const plan = await getCollectionBatchSyncPlanAction(collectionId);
        if (!plan.success) {
          setToast({
            message: plan.error || 'Failed to prepare the batch sync plan.',
            type: 'error',
          });
          return;
        }

        if (plan.batches.length === 0) {
          setToast({
            message: 'No batches were found for this collection.',
            type: 'error',
          });
          return;
        }

        let batchesSynced = 0;
        let winnersCount = 0;
        let commentsFetched = 0;
        let commentsSaved = 0;
        let commentUpsertErrors = 0;
        const failedBatches: string[] = [];

        for (const [index, batch] of plan.batches.entries()) {
          setProgress({
            current: index + 1,
            total: plan.batches.length,
            label: batch.title,
          });

          const result = await syncBatchCommentsAction(batch.id, { deferTotalsRefresh: true });
          if (!result.success) {
            failedBatches.push(batch.title);
          } else {
            batchesSynced += 1;
          }

          winnersCount += result.winnersCount || 0;
          commentsFetched += result.commentsFetched || 0;
          commentsSaved += result.commentsSaved || 0;
          commentUpsertErrors += result.commentUpsertErrors || 0;
        }

        const finalizeResult = await finalizeCollectionBatchCommentSyncAction(collectionId);
        if (!finalizeResult.success) {
          setToast({
            message: finalizeResult.error || 'Batch comments synced, but totals refresh failed.',
            type: 'error',
          });
          return;
        }

        setProgress(null);

        if (batchesSynced === 0) {
          setToast({
            message: 'All batches failed to sync comments.',
            type: 'error',
          });
          return;
        }

        const failedSummary = failedBatches.length > 0
          ? ` ${failedBatches.length} batch(es) failed.`
          : '';

        setToast({
          message: `Synced ${batchesSynced} batches, fetched ${commentsFetched} comments, saved ${commentsSaved}, detected ${winnersCount} winners, and hit ${commentUpsertErrors} comment save errors.${failedSummary}`,
          type: failedBatches.length > 0 ? 'error' : 'success',
        });
      } catch (error) {
        setProgress(null);
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
        description={progress
          ? `Processing batch ${progress.current} of ${progress.total}: ${progress.label}`
          : 'MineTally is scanning every batch in this collection, resolving confirmed buyers, and updating the latest totals.'}
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
