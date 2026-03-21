'use client';

import { 
  SquarePen, 
  Undo2, 
  ShieldAlert, 
  Lock, 
  Save, 
  PencilLine,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useState, useTransition } from "react";
import { updateItemAction } from "@/actions/workflow";
import { ItemWorkflowDetail } from "@/types";

interface ItemActionButtonsProps {
  collectionId: string;
  batchId: string;
  item: ItemWorkflowDetail;
}

export function ItemActionButtons({ collectionId, batchId, item }: ItemActionButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [showManualWinner, setShowManualWinner] = useState(false);
  const [manualBuyerName, setManualBuyerName] = useState("");

  const handleAction = (action: string) => {
    startTransition(async () => {
      if (action === 'unclaimed') {
        await updateItemAction(collectionId, batchId, item.id, { status: 'unclaimed' });
      } else if (action === 'needs_review') {
        await updateItemAction(collectionId, batchId, item.id, { status: 'needs_review' });
      } else if (action === 'lock') {
        await updateItemAction(collectionId, batchId, item.id, { lockItem: true });
      }
    });
  };

  const handleSaveManual = () => {
    if (!manualBuyerName) return;
    startTransition(async () => {
      await updateItemAction(collectionId, batchId, item.id, {
        winnerBuyerId: `manual-${Date.now()}`,
        winnerBuyerName: manualBuyerName,
        status: 'manual_override',
        note: 'Seller manual winner override from detail page.'
      });
      setShowManualWinner(false);
      setManualBuyerName("");
    });
  };

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto xl:justify-end">
      {showManualWinner ? (
        <div className="flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm animate-in fade-in slide-in-from-right-4 sm:w-auto sm:flex-row sm:items-center sm:p-1">
          <input 
            type="text"
            placeholder="Buyer Name..."
            value={manualBuyerName}
            onChange={(e) => setManualBuyerName(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:h-9 sm:min-w-[180px] sm:border-0 sm:bg-transparent sm:focus:ring-0"
            autoFocus
          />
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="h-10 flex-1 rounded-lg bg-emerald-600 px-3 font-bold sm:h-8 sm:flex-none"
              onClick={handleSaveManual}
              disabled={isPending}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              Set
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-10 rounded-lg px-3 font-bold sm:h-8 sm:px-2"
              onClick={() => setShowManualWinner(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button 
          variant="outline" 
          className="h-11 w-full rounded-xl font-bold sm:w-auto"
          onClick={() => setShowManualWinner(true)}
          disabled={isPending || item.status === 'locked'}
        >
          <SquarePen className="mr-2 h-4 w-4" />
          Set Manual Winner
        </Button>
      )}
      
      <Button 
        variant="outline" 
        className="h-11 w-full rounded-xl font-bold sm:w-auto"
        onClick={() => handleAction('unclaimed')}
        disabled={isPending || item.status === 'locked'}
      >
        <Undo2 className="mr-2 h-4 w-4" />
        Mark Unclaimed
      </Button>
      
      <Button 
        variant="outline" 
        className="h-11 w-full rounded-xl font-bold text-amber-700 sm:w-auto"
        onClick={() => handleAction('needs_review')}
        disabled={isPending || item.status === 'locked'}
      >
        <ShieldAlert className="mr-2 h-4 w-4" />
        Needs Review
      </Button>
      
      <Button 
        className="h-11 w-full rounded-xl bg-indigo-600 font-bold sm:w-auto"
        onClick={() => handleAction('lock')}
        disabled={isPending || item.status === 'locked'}
      >
        <Lock className="mr-2 h-4 w-4" />
        {item.status === 'locked' ? 'Item Locked' : 'Lock Item'}
      </Button>
    </div>
  );
}

export function PriceOverrideAction({ collectionId, batchId, item }: ItemActionButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [overridePrice, setOverridePrice] = useState("");

  const handleSavePrice = () => {
    if (!overridePrice) return;
    startTransition(async () => {
      await updateItemAction(collectionId, batchId, item.id, {
        resolvedPrice: parseFloat(overridePrice),
        status: 'manual_override',
        note: `Price override to ${overridePrice}`
      });
      setOverridePrice("");
    });
  };

  return (
    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        type="number"
        placeholder="Only if needed"
        value={overridePrice}
        onChange={(e) => setOverridePrice(e.target.value)}
        className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
        disabled={isPending || item.status === 'locked'}
      />
      <Button 
        variant="outline" 
        className="h-11 w-full rounded-xl font-bold sm:w-auto"
        onClick={handleSavePrice}
        disabled={isPending || item.status === 'locked'}
      >
        <PencilLine className="mr-2 h-4 w-4" />
        Save Override
      </Button>
    </div>
  );
}
