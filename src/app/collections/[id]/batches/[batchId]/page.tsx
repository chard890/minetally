import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  MessageSquare,
  RefreshCw,
  Search,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { SyncCommentsButton } from "@/components/workflow/SyncCommentsButton";
import { BatchItemsList } from "@/components/workflow/BatchItemsList";
import { SupabaseConfigGuide } from "@/components/workflow/SupabaseConfigGuide";
import { formatClaimWord, formatCurrency, formatShortDate } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase";
import { collectionService } from "@/services/collection.service";

function getItemStatusVariant(status: string) {
  switch (status) {
    case "claimed":
      return "emerald";
    case "needs_review":
      return "amber";
    case "manual_override":
      return "blue";
    case "locked":
      return "slate";
    default:
      return "slate";
  }
}

export default async function BatchDetailsPage({
  params,
}: {
  params: Promise<{ id: string; batchId: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <SupabaseConfigGuide />;
  }

  const { id, batchId } = await params;
  console.log(`[BatchDetailsPage] ID: ${id}, BatchID: ${batchId}`);
  const collection = await collectionService.getCollection(id);
  const batch = await collectionService.getBatch(id, batchId);
  
  console.log(`[BatchDetailsPage] Collection found: ${!!collection}`);
  console.log(`[BatchDetailsPage] Batch found: ${!!batch}`);
  if (batch) {
    console.log(`[BatchDetailsPage] Batch title: ${batch.title}`);
    console.log(`[BatchDetailsPage] Batch items type: ${typeof batch.items}`);
    console.log(`[BatchDetailsPage] Batch items is array: ${Array.isArray(batch.items)}`);
  }

  if (!collection || !batch) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="flex items-center space-x-5">
          <Link href={`/collections/${id}`}>
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl border-slate-200">
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Button>
          </Link>
          <div>
            <div className="mb-1 flex items-center space-x-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{batch.title}</h1>
              <StatusBadge
                label={batch.syncStatus}
                variant={batch.syncStatus === "synced" ? "indigo" : batch.syncStatus === "attention" ? "amber" : "slate"}
              />
            </div>
            <p className="text-sm font-medium text-slate-500">
              Part of <span className="font-bold text-slate-700">{collection.name}</span> | Posted{" "}
              {formatShortDate(batch.postedAt)} | {batch.itemPhotos} item photos
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" className="rounded-xl font-bold">
            <RefreshCw className="mr-2 h-4 w-4" />
            Resync Batch
          </Button>
          <SyncCommentsButton collectionId={id} batchId={batchId} />
        </div>
      </div>

      <div className="flex items-center space-x-6 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center space-x-3 border-r border-slate-100 px-2">
          <Database className="h-5 w-5 text-slate-400" />
          <span className="text-sm font-bold text-slate-900">
            {batch.itemPhotos} <span className="font-medium text-slate-400">Items</span>
          </span>
        </div>
        <div className="flex items-center space-x-3 border-r border-slate-100 px-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <span className="text-sm font-bold text-slate-900">
            {batch.claimedItems} <span className="font-medium text-slate-400">Claimed</span>
          </span>
        </div>
        <div className="flex items-center space-x-3 border-r border-slate-100 px-2">
          <Clock className="h-5 w-5 text-slate-400" />
          <span className="text-sm font-bold text-slate-900">
            {batch.itemPhotos - batch.claimedItems - batch.needsReviewCount} <span className="font-medium text-slate-400">Unclaimed</span>
          </span>
        </div>
        <div className="flex items-center space-x-3 px-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span className="text-sm font-bold text-slate-900">
            {batch.needsReviewCount} <span className="font-medium text-slate-400">Needs Review</span>
          </span>
        </div>
      </div>

      <BatchItemsList items={batch.items || []} collectionId={id} />
    </div>
  );
}
