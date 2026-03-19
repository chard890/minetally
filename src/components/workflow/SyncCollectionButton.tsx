'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useState, useTransition } from 'react';
import { syncCollectionAction } from '@/actions/workflow';
import { Toast, ToastType } from '@/components/ui/Toast';

interface SyncCollectionButtonProps {
  collectionId: string;
}

export function SyncCollectionButton({ collectionId }: SyncCollectionButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Sync failed. Check diagnostics for details.";

  const handleSync = () => {
    startTransition(async () => {
      try {
        const result = await syncCollectionAction(collectionId);
        if ('error' in result && result.error) {
          setToast({ message: result.error, type: 'error' });
        } else if ('postsImported' in result) {
          setToast({ 
            message: `Successfully imported ${result.postsImported} posts.`, 
            type: result.postsImported > 0 ? 'success' : 'info' 
          });
        }
      } catch (error) {
        setToast({ message: getErrorMessage(error), type: 'error' });
      }
    });
  };

  return (
    <>
      <Button 
        variant="outline"
        size="sm"
        className="text-[#7a62b7]"
        disabled={isPending}
        onClick={handleSync}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
        {isPending ? "Syncing..." : "Sync Collection Posts"}
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
