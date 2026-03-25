"use client";

import { useState } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { deleteCollectionAction } from "@/actions/collection.actions";
import { useRouter } from "next/navigation";

interface DeleteCollectionButtonProps {
  collectionId: string;
  collectionName: string;
}

export function DeleteCollectionButton({
  collectionId,
  collectionName,
}: DeleteCollectionButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteCollectionAction(collectionId);
      if (result.success) {
        setIsConfirming(false);
        router.refresh();
      } else {
        alert(result.error || "Failed to delete collection. Please try again.");
        setIsConfirming(false);
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("An error occurred while deleting the collection.");
      setIsConfirming(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsConfirming(false);
  };

  if (isConfirming) {
    return (
      <div className="flex items-center space-x-2 rounded-xl bg-red-50 p-1 px-2 ring-1 ring-red-100 transition-all">
        <AlertTriangle className="h-3 w-3 text-red-500" />
        <span className="text-[10px] font-bold text-red-600">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded px-1 text-[10px] font-black uppercase tracking-wider text-red-600 hover:bg-red-100 disabled:opacity-50"
        >
          {isDeleting ? "..." : "Confirm"}
        </button>
        <span className="text-slate-300">|</span>
        <button
          onClick={handleCancel}
          disabled={isDeleting}
          className="rounded px-1 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:bg-slate-100 transition-colors"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
      onClick={handleDelete}
      title="Delete Collection"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
