import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Facebook,
  Layers,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { MetricCard } from "@/components/workflow/MetricCard";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { SupabaseConfigGuide } from "@/components/workflow/SupabaseConfigGuide";
import { formatCurrency, formatDateRange, formatShortDate } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase";
import { collectionService } from "@/services/collection.service";
import { SyncCollectionButton } from "@/components/workflow/SyncCollectionButton";
import { SyncAllBatchCommentsButton } from "@/components/workflow/SyncAllBatchCommentsButton";

function getSyncBadge(syncStatus: string) {
  switch (syncStatus) {
    case "synced":
      return "indigo";
    case "attention":
      return "amber";
    case "syncing":
      return "blue";
    default:
      return "slate";
  }
}

export default async function CollectionDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <SupabaseConfigGuide />;
  }

  const { id } = await params;
  const collection = await collectionService.getCollection(id);

  if (!collection) {
    notFound();
  }

  const allItems = collection.batches.flatMap((batch) => batch.items);
  const totalBatchPosts = collection.batches.length;
  const totalItemPhotos = allItems.length;
  const totalComments = allItems.reduce((sum, item) => sum + item.commentCount, 0);
  const totalClaimedItems = allItems.filter((item) =>
    item.status === "claimed" || item.status === "manual_override" || item.status === "locked",
  ).length;
  const totalNeedsReview = allItems.filter((item) => item.status === "needs_review").length;
  const totalManualOverrides = allItems.filter((item) => item.hasManualOverride).length;
  const totalCancelItems = allItems.filter((item) => item.cancelCount > 0).length;
  const totalCollectionValue = allItems.reduce((sum, item) => {
    if (
      item.resolvedPrice === null ||
      !["claimed", "manual_override", "locked"].includes(item.status)
    ) {
      return sum;
    }

    return sum + item.resolvedPrice;
  }, 0);
  const batchSummaries = collection.batches.map((batch) => {
    const claimedItems = batch.items.filter((item) =>
      item.status === "claimed" || item.status === "manual_override" || item.status === "locked",
    ).length;
    const needsReviewCount = batch.items.filter((item) => item.status === "needs_review").length;
    const itemPhotos = batch.items.length;

    return {
      ...batch,
      itemPhotos,
      claimedItems,
      needsReviewCount,
      unclaimedItems: Math.max(itemPhotos - claimedItems - needsReviewCount, 0),
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="flex items-center space-x-5">
          <Link href="/collections">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-2xl border-slate-200 shadow-sm hover:bg-slate-50"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Button>
          </Link>
          <div>
            <div className="mb-1 flex items-center space-x-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {collection.name}
              </h1>
              <StatusBadge
                label={collection.status}
                variant={collection.status === "open" ? "emerald" : collection.status === "finalized" ? "indigo" : "slate"}
              />
            </div>
            <div className="flex items-center space-x-4 text-sm font-medium text-slate-500">
              <div className="flex items-center">
                <Calendar className="mr-1.5 h-4 w-4 text-slate-400" />
                {formatDateRange(collection.startDate, collection.endDate)}
              </div>
              <div className="flex items-center">
                <Facebook className="mr-1.5 h-4 w-4 text-blue-500" />
                {collection.connectedFacebookPage}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SyncCollectionButton 
            collectionId={id} 
          />
          <SyncAllBatchCommentsButton
            collectionId={id}
          />
          <Link href={`/collections/${id}/finalize`}>
            <Button className="rounded-xl bg-indigo-600 px-6 font-bold shadow-lg shadow-indigo-100">
              <Lock className="mr-2 h-4 w-4" />
              Finalize Collection
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Batch Posts"
          value={totalBatchPosts}
          icon={Layers}
          colorClass="text-indigo-600"
          backgroundClass="bg-indigo-50"
        />
        <MetricCard
          label="Item Photos"
          value={totalItemPhotos}
          icon={Database}
          colorClass="text-blue-600"
          backgroundClass="bg-blue-50"
        />
        <MetricCard
          label="Claimed Items"
          value={totalClaimedItems}
          icon={CheckCircle2}
          colorClass="text-emerald-600"
          backgroundClass="bg-emerald-50"
        />
        <MetricCard
          label="Unclaimed Items"
          value={Math.max(totalItemPhotos - totalClaimedItems - totalNeedsReview, 0)}
          icon={Clock}
          colorClass="text-slate-400"
          backgroundClass="bg-slate-50"
        />
        <MetricCard
          label="Needs Review"
          value={totalNeedsReview}
          icon={AlertTriangle}
          colorClass="text-amber-600"
          backgroundClass="bg-amber-50"
        />
        <MetricCard
          label="Collection Value"
          value={formatCurrency(totalCollectionValue)}
          icon={Lock}
          colorClass="text-slate-700"
          backgroundClass="bg-slate-100"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Imported Facebook Batch Posts</h2>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {collection.batches.length} imported batches
          </div>
        </div>

        <div className="grid gap-4">
          {batchSummaries.map((batch) => (
            <Card
              key={batch.id}
              className="overflow-hidden border-0 shadow-sm ring-1 ring-slate-100 transition-all duration-300 hover:shadow-md hover:ring-indigo-200"
            >
              <CardContent className="p-0">
                <div className="flex flex-col gap-4 bg-white p-6 md:flex-row md:items-center md:gap-0">
                  <div className="flex flex-1 items-center space-x-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600">
                      <Layers className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{batch.title}</h3>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Posted {formatShortDate(batch.postedAt)}
                        {batch.syncNote ? ` | ${batch.syncNote}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-8 px-2 md:space-x-12">
                    <div className="text-center">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Item Photos
                      </p>
                      <p className="text-sm font-black text-slate-900">{batch.itemPhotos}</p>
                    </div>
                    <div className="text-center">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Claimed
                      </p>
                      <p className="text-sm font-black text-emerald-600">{batch.claimedItems}</p>
                    </div>
                    <div className="text-center">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Unclaimed
                      </p>
                      <p className="text-sm font-black text-slate-400">
                        {batch.unclaimedItems}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Needs Review
                      </p>
                      <p className="text-sm font-black text-amber-600">
                        {batch.needsReviewCount}
                      </p>
                    </div>
                  </div>

                  <div className="ml-auto flex min-w-[220px] items-center justify-end space-x-6">
                    <div className="flex flex-col items-end space-y-1.5">
                      <StatusBadge
                        label={batch.syncStatus}
                        variant={getSyncBadge(batch.syncStatus) as "indigo" | "amber" | "blue" | "slate"}
                      />
                      {batch.last_synced_at && (
                        <p className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
                          Synced {formatShortDate(batch.last_synced_at)}
                        </p>
                      )}
                    </div>
                    <Link href={`/collections/${id}/batches/${batch.id}`}>
                      <Button variant="outline" size="sm" className="rounded-xl font-bold">
                        Open Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
