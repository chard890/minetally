'use client';

import { useState, useTransition } from 'react';
import { PencilLine, Save, X } from 'lucide-react';
import { overrideCommenterNameAction } from '@/actions/collection.actions';
import { Button } from '@/components/ui/Button';
import { Toast, ToastType } from '@/components/ui/Toast';

interface CommenterNameOverrideProps {
  collectionId: string;
  itemId: string;
  commentId: string;
  currentName: string;
}

const UNKNOWN_COMMENTER = 'Unknown commenter';

export function CommenterNameOverride({
  collectionId,
  itemId,
  commentId,
  currentName,
}: CommenterNameOverrideProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentName);
  const [draftName, setDraftName] = useState(
    currentName === UNKNOWN_COMMENTER ? '' : currentName,
  );
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const handleSave = () => {
    const nextName = draftName.trim();
    if (!nextName) {
      setToast({ message: 'Commenter name is required.', type: 'error' });
      return;
    }

    startTransition(async () => {
      const result = await overrideCommenterNameAction({
        collectionId,
        itemId,
        commentId,
        commenterName: nextName,
      });

      if (!result.success) {
        setToast({ message: result.error || 'Failed to save commenter name.', type: 'error' });
        return;
      }

      setDisplayName(nextName);
      setDraftName(nextName);
      setIsEditing(false);
      setToast({ message: 'Commenter name updated.', type: 'success' });
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {isEditing ? (
          <>
            <input
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Enter commenter name"
              className="h-9 min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isPending}
              autoFocus
            />
            <Button
              size="sm"
              className="h-9 rounded-lg bg-slate-900 px-3 font-bold"
              onClick={handleSave}
              disabled={isPending}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-lg px-2 font-bold text-slate-500"
              onClick={() => {
                setDraftName(displayName === UNKNOWN_COMMENTER ? '' : displayName);
                setIsEditing(false);
              }}
              disabled={isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-slate-900">{displayName}</p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-slate-200 px-2.5 font-bold text-slate-600"
              onClick={() => setIsEditing(true)}
            >
              <PencilLine className="mr-1.5 h-3.5 w-3.5" />
              {displayName === UNKNOWN_COMMENTER ? 'Add name' : 'Edit'}
            </Button>
          </>
        )}
      </div>

      {toast ? (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      ) : null}
    </>
  );
}
