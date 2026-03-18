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
    <div className="flex flex-wrap items-center gap-3">
      {showManualWinner ? (
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-4">
          <input 
            type="text"
            placeholder="Buyer Name..."
            value={manualBuyerName}
            onChange={(e) => setManualBuyerName(e.target.value)}
            className="h-9 px-3 text-sm font-medium border-0 focus:ring-0 bg-transparent min-w-[150px]"
            autoFocus
          />
          <Button 
            size="sm" 
            className="h-8 rounded-lg bg-emerald-600 font-bold px-3"
            onClick={handleSaveManual}
            disabled={isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Set
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 rounded-lg font-bold px-2"
            onClick={() => setShowManualWinner(false)}
          >
            Esc
          </Button>
        </div>
      ) : (
        <Button 
          variant="outline" 
          className="rounded-xl font-bold"
          onClick={() => setShowManualWinner(true)}
          disabled={isPending || item.status === 'locked'}
        >
          <SquarePen className="mr-2 h-4 w-4" />
          Set Manual Winner
        </Button>
      )}
      
      <Button 
        variant="outline" 
        className="rounded-xl font-bold"
        onClick={() => handleAction('unclaimed')}
        disabled={isPending || item.status === 'locked'}
      >
        <Undo2 className="mr-2 h-4 w-4" />
        Mark Unclaimed
      </Button>
      
      <Button 
        variant="outline" 
        className="rounded-xl font-bold text-amber-700"
        onClick={() => handleAction('needs_review')}
        disabled={isPending || item.status === 'locked'}
      >
        <ShieldAlert className="mr-2 h-4 w-4" />
        Needs Review
      </Button>
      
      <Button 
        className="rounded-xl bg-indigo-600 font-bold"
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
    <div className="mt-3 flex items-center gap-3">
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
        className="h-11 rounded-xl font-bold"
        onClick={handleSavePrice}
        disabled={isPending || item.status === 'locked'}
      >
        <PencilLine className="mr-2 h-4 w-4" />
        Save Override
      </Button>
    </div>
  );
}
