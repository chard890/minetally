import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  Facebook,
  Layers,
  Lock,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { MetricCard } from "@/components/workflow/MetricCard";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { formatClaimWord, formatCurrency, formatDateTime, formatDateRange } from "@/lib/format";
import { collectionService } from "@/services/collection.service";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SupabaseConfigGuide } from "@/components/workflow/SupabaseConfigGuide";
import { CollectionListItem, RecentWinningClaim } from "@/types";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseConfigGuide />;
  }

  const dashboard = await collectionService.getDashboardSnapshot();
  const activeCollection = dashboard.activeCollection;
  const buyerTotals = activeCollection 
    ? await collectionService.getBuyerTotals(activeCollection.id)
    : [];

  if (!activeCollection) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 py-20">
        <div className="rounded-full bg-slate-100 p-6">
          <Layers className="h-12 w-12 text-slate-400" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900">No Active Collections</h2>
          <p className="mt-2 text-slate-500 max-w-sm">
            You don&apos;t have any open collections yet. Create a collection to start tracking your Facebook ukay workflow.
          </p>
        </div>
        <Link href="/collections">
          <Button className="bg-indigo-600">
            Go to Collections
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Seller Dashboard</h1>
          <p className="mt-1 text-slate-500">
            Photo-based claim reconciliation for your Facebook ukay workflow.
          </p>
        </div>
        <div className="flex space-x-3">
          <Link href="/collections">
            <Button variant="outline">View Collections</Button>
          </Link>
          <Link href={`/collections/${activeCollection.id}`}>
            <Button className="bg-indigo-600">
              <Facebook className="mr-2 h-4 w-4" />
              Open Live Collection
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Active Collections"
          value={dashboard.activeCollections}
          icon={Calendar}
          colorClass="text-blue-600"
          backgroundClass="bg-blue-50"
        />
        <MetricCard
          label="Imported Batch Posts"
          value={dashboard.importedBatchPosts}
          icon={Layers}
          colorClass="text-indigo-600"
          backgroundClass="bg-indigo-50"
        />
        <MetricCard
          label="Claimed Items"
          value={dashboard.claimedItems}
          icon={ShoppingBag}
          colorClass="text-emerald-600"
          backgroundClass="bg-emerald-50"
        />
        <MetricCard
          label="Needs Review"
          value={dashboard.needsReview}
          icon={AlertCircle}
          colorClass="text-amber-600"
          backgroundClass="bg-amber-50"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card className="border-0 shadow-sm ring-1 ring-slate-100">
            <CardHeader className="border-b border-slate-50 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">Active Collection Overview</CardTitle>
                <StatusBadge label="Live Now" variant="emerald" />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {activeCollection.name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {formatDateRange(
                        activeCollection.startDate,
                        activeCollection.endDate,
                      )}{" "}
                      | {activeCollection.totalBatchPosts} batch posts imported
                    </p>
                  </div>
                  <Link href={`/collections/${activeCollection.id}`}>
                    <Button variant="secondary" size="sm">
                      Open Collection
                    </Button>
                  </Link>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Item Photos
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {activeCollection.totalItemPhotos}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Claimed
                    </p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {activeCollection.totalClaimedItems}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Needs Review
                    </p>
                    <p className="text-2xl font-bold text-amber-600">
                      {activeCollection.needsReviewCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Collection Value
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(activeCollection.totalCollectionValue)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-slate-100">
            <CardHeader className="border-b border-slate-50 pb-4">
              <CardTitle className="text-lg font-bold">Recent Winning Claims</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-5">
                {dashboard.recentWinningClaims.map((claim: RecentWinningClaim) => (
                  <Link
                    key={claim.itemId}
                    href={`/collections/${claim.collectionId}/items/${claim.itemId}`}
                    className="group flex items-center space-x-4"
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-2xl ring-1 ring-slate-200">
                      <img
                        src={claim.thumbnailUrl}
                        alt={`Item ${claim.itemNumber}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="truncate font-bold text-slate-900 group-hover:text-indigo-600">
                          {claim.buyerName}
                        </span>
                        <StatusBadge
                          label={formatClaimWord(claim.claimWord)}
                          variant="emerald"
                          className="px-2 py-0.5"
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        Item #{String(claim.itemNumber).padStart(2, "0")} from {claim.batchTitle}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">
                        {formatCurrency(claim.resolvedPrice)}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {formatDateTime(claim.claimedAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-0 bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500/20">
            <CardContent className="pt-6">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-100">
                Current Running Value
              </p>
              <h2 className="mt-2 text-4xl font-black">
                {formatCurrency(activeCollection.totalCollectionValue)}
              </h2>
              <div className="mt-6 flex items-center justify-between border-t border-indigo-500 pt-6">
                <div className="text-xs">
                  <p className="font-medium text-indigo-100">Finalizable Buyers</p>
                  <p className="font-bold">
                    {buyerTotals.length} buyers
                  </p>
                </div>
                <Lock className="h-5 w-5 text-indigo-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-slate-100">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">
                Recent Finalized Collections
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dashboard.recentFinalizedCollections.map((collection: CollectionListItem) => (
                <Link
                  key={collection.id}
                  href={`/collections/${collection.id}`}
                  className="block rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition-colors hover:border-indigo-100 hover:bg-white"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{collection.name}</p>
                      <p className="text-xs text-slate-500">
                        Finalized {collection.finalizeDate ? formatDateTime(collection.finalizeDate) : "later"}
                      </p>
                    </div>
                    <StatusBadge
                      label={collection.status}
                      variant={collection.status === "locked" ? "slate" : "indigo"}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>{collection.totalClaimedItems} claimed</span>
                    <span>{formatCurrency(collection.totalCollectionValue)}</span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-slate-100">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">
                Live Collection Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeCollection.batches.slice(0, 4).map((batch) => (
                <div key={batch.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{batch.title}</p>
                    <p className="text-xs text-slate-500">
                      {batch.claimedItems}/{batch.itemPhotos} claimed
                    </p>
                  </div>
                  <StatusBadge
                    label={batch.syncStatus}
                    variant={
                      batch.syncStatus === "synced"
                        ? "indigo"
                        : batch.syncStatus === "attention"
                          ? "amber"
                          : "slate"
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
