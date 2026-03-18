'use client';

import { RefreshCw, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTransition } from "react";
import { finalizeCollectionAction, syncBatchAction } from "@/actions/workflow";
import { useRouter } from "next/navigation";

interface FinalizeActionsProps {
  collectionId: string;
  readyToFinalize: boolean;
  isLocked: boolean;
}

export function FinalizeActions({ collectionId, readyToFinalize, isLocked }: FinalizeActionsProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleRecount = () => {
    startTransition(async () => {
      // In simulation, we just reload the data
      router.refresh();
    });
  };

  const handleFinalize = () => {
    if (!readyToFinalize && !confirm("There are still items that need review. Are you sure you want to finalize?")) {
      return;
    }
    
    startTransition(async () => {
      const result = await finalizeCollectionAction(collectionId);
      if (result.success) {
        router.push('/collections');
      }
    });
  };

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        className="h-14 w-full gap-3 rounded-2xl border-slate-200 font-bold text-slate-600"
        onClick={handleRecount}
        disabled={isPending || isLocked}
      >
        <RefreshCw className={`h-5 w-5 ${isPending ? 'animate-spin' : ''}`} />
        Run Final Recount
      </Button>
      <Button 
        className="h-14 w-full rounded-2xl bg-indigo-600 text-lg font-black shadow-lg shadow-indigo-100"
        onClick={handleFinalize}
        disabled={isPending || isLocked}
      >
        <Lock className="mr-2 h-5 w-5" />
        {isLocked ? 'Collection Locked' : 'Finalize and Lock Collection'}
      </Button>
    </div>
  );
}
