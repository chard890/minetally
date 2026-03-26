import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  Layers,
  Search,
  ShoppingBag,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { MetricCard } from "@/components/workflow/MetricCard";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { formatClaimWord, formatCurrency, formatDateTime, formatDateRange } from "@/lib/format";
import { collectionService } from "@/services/collection.service";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SupabaseConfigGuide } from "@/components/workflow/SupabaseConfigGuide";
import { RecentWinningClaim } from "@/types";

export const dynamic = "force-dynamic";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getRecentClaimStatusLabel(claim: RecentWinningClaim) {
  if (claim.status === "needs_review") {
    return "Needs review";
  }

  if (claim.status === "manual_override") {
    return "Manual winner";
  }

  if (claim.status === "locked") {
    return "Locked winner";
  }

  return "Confirmed winning";
}

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseConfigGuide />;
  }

  const dashboard = await collectionService.getDashboardSnapshot();
  const activeCollection = dashboard.activeCollection;
  const buyerTotals = activeCollection 
    ? await collectionService.getBuyerTotals(activeCollection.id)
    : [];
  const activeItems = activeCollection
    ? activeCollection.batches.flatMap((batch) => batch.items)
    : [];
  const derivedActiveBatchPosts = activeCollection ? activeCollection.batches.length : 0;
  const derivedActiveItemPhotos = activeItems.length;
  const derivedActiveClaimedItems = activeItems.filter((item) =>
    item.status === "claimed" || item.status === "manual_override" || item.status === "locked",
  ).length;
  const derivedActiveNeedsReview = activeItems.filter((item) => item.status === "needs_review").length;
  const derivedActiveCollectionValue = activeItems.reduce((sum, item) => {
    if (
      item.resolvedPrice === null ||
      !["claimed", "manual_override", "locked"].includes(item.status)
    ) {
      return sum;
    }

    return sum + item.resolvedPrice;
  }, 0);
  const dashboardImportedBatchPosts =
    dashboard.importedBatchPosts > 0 ? dashboard.importedBatchPosts : derivedActiveBatchPosts;
  const dashboardClaimedItems =
    dashboard.claimedItems > 0 ? dashboard.claimedItems : derivedActiveClaimedItems;
  const dashboardNeedsReview =
    dashboard.needsReview > 0 ? dashboard.needsReview : derivedActiveNeedsReview;
  const hasImportedData = Boolean(
    activeCollection &&
      (
        derivedActiveBatchPosts > 0 ||
        derivedActiveItemPhotos > 0 ||
        derivedActiveClaimedItems > 0 ||
        derivedActiveNeedsReview > 0 ||
        dashboard.recentWinningClaims.length > 0
      ),
  );
  const metricValue = (value: number) => (value === 0 && !hasImportedData ? "Not synced" : value);
  const collectionValueLabel =
    activeCollection && derivedActiveCollectionValue === 0 && !hasImportedData
      ? "No value yet"
      : formatCurrency(derivedActiveCollectionValue);
  const topBuyers = buyerTotals.slice(0, 5);
  const totalBuyerClaimValue = buyerTotals.reduce((sum, buyer) => sum + buyer.totalAmount, 0);
  const totalBuyerClaimedItems = buyerTotals.reduce((sum, buyer) => sum + buyer.totalWonItems, 0);
  const manualFixes = activeCollection
    ? activeCollection.batches.flatMap((batch) => batch.items).filter((item) => item.hasManualOverride).length
    : 0;
  const pendingIssues = activeCollection
    ? activeCollection.batches.filter((batch) => batch.syncStatus === "attention").length
    : 0;
  const liveStatusRows = activeCollection ? activeCollection.batches.slice(0, 5) : [];

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
    <div className="space-y-3 sm:space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between xl:flex-1">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-slate-900 sm:text-[30px]">Seller Dashboard</h1>
            <p className="mt-0.5 text-[12px] leading-5 text-slate-500 sm:text-sm sm:leading-6">
              Photo-based claim reconciliation for your Facebook ukay workflow.
            </p>
          </div>
          <div className="relative w-full max-w-none sm:max-w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8594]" />
            <input
              type="text"
              placeholder="Search buyers, batches, or items"
              className="h-10 w-full min-w-0 pl-10 pr-3 text-[13px] font-medium sm:h-11 sm:pr-4 sm:text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.95fr)]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              label="Active Collections"
              value={dashboard.activeCollections}
              icon={Calendar}
              colorClass="text-blue-600"
              backgroundClass="bg-blue-50"
            />
            <MetricCard
              label="Imported Batch Posts"
              value={metricValue(dashboardImportedBatchPosts)}
              icon={Layers}
              colorClass="text-indigo-600"
              backgroundClass="bg-indigo-50"
            />
            <MetricCard
              label="Claimed Items"
              value={metricValue(dashboardClaimedItems)}
              icon={ShoppingBag}
              colorClass="text-emerald-600"
              backgroundClass="bg-emerald-50"
            />
            <MetricCard
              label="Needs Review"
              value={metricValue(dashboardNeedsReview)}
              icon={AlertCircle}
              colorClass="text-amber-600"
              backgroundClass="bg-amber-50"
            />
          </div>

          <Card className="border-0 shadow-sm ring-1 ring-slate-100">
            <CardHeader className="border-b border-slate-50 px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Recent Winning Claims</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-4 sm:p-5 sm:pt-4">
              {dashboard.recentWinningClaims.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.recentWinningClaims.map((claim: RecentWinningClaim) => (
                    <Link
                      key={claim.itemId}
                      href={`/collections/${claim.collectionId}/items/${claim.itemId}`}
                      className="group flex min-w-0 flex-col gap-3 rounded-2xl border border-transparent px-1 py-1.5 hover:border-slate-100 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3 sm:flex-1 sm:items-center">
                        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[rgba(255,142,110,0.14)] text-[10px] font-bold text-[#7a62b7] ring-1 ring-white/50 sm:h-9 sm:w-9 sm:text-[11px]">
                            {getInitials(claim.buyerName)}
                          </div>
                          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200 sm:h-9 sm:w-9">
                            <img
                              src={claim.thumbnailUrl}
                              alt={`Item ${claim.itemNumber}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="block truncate text-sm font-semibold leading-none text-slate-900 group-hover:text-indigo-600">
                                {claim.buyerName}
                              </span>
                              <StatusBadge
                                label={formatClaimWord(claim.claimWord)}
                                variant="emerald"
                                className="px-2 py-0.5 text-[10px]"
                              />
                            </div>
                            <p className="mt-1 text-[11px] leading-4 text-slate-500">
                              Item #{String(claim.itemNumber).padStart(2, "0")} from {claim.batchTitle}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold leading-none text-slate-900">
                            {getRecentClaimStatusLabel(claim)}
                          </p>
                          <p className="mt-1 text-[11px] leading-none text-slate-500">
                            {claim.resolvedPrice === null ? "Price pending" : formatCurrency(claim.resolvedPrice)}
                          </p>
                          <p className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.2em] leading-none text-slate-400 sm:block">
                            {formatDateTime(claim.claimedAt)}
                          </p>
                        </div>
                      </div>
                      <p className="pl-10 text-[10px] font-semibold uppercase tracking-[0.16em] leading-none text-slate-400 sm:hidden">
                        {formatDateTime(claim.claimedAt)}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
                  Winning claims will appear here after you sync comments and the app resolves first claimants.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-slate-100">
            <CardHeader className="border-b border-slate-50 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base font-semibold">Active Collection Overview</CardTitle>
                <StatusBadge label="Live Now" variant="emerald" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-4 sm:p-5 sm:pt-4">
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold leading-tight text-slate-900">
                      {activeCollection.name}
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-slate-500">
                      {formatDateRange(
                        activeCollection.startDate,
                        activeCollection.endDate,
                      )}{" "}
                      | {derivedActiveBatchPosts} batch posts imported
                    </p>
                  </div>
                  <Link href={`/collections/${activeCollection.id}`}>
                    <Button variant="secondary" size="sm" className="w-full sm:w-auto">
                      Open Collection
                    </Button>
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-3 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Item Photos
                    </p>
                    <p className="mt-1.5 text-xl font-semibold leading-none text-slate-900">
                      {metricValue(derivedActiveItemPhotos)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-3 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Claimed
                    </p>
                    <p className="mt-1.5 text-xl font-semibold leading-none text-emerald-600">
                      {metricValue(derivedActiveClaimedItems)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-3 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Needs Review
                    </p>
                    <p className="mt-1.5 text-xl font-semibold leading-none text-amber-600">
                      {metricValue(derivedActiveNeedsReview)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-3 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Collection Value
                    </p>
                    <p className="mt-1.5 text-xl font-semibold leading-none text-slate-900">
                      {collectionValueLabel}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm ring-1 ring-slate-100">
            <CardHeader className="border-b border-slate-50 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base font-semibold">Buyer Totals</CardTitle>
                <Link href={`/buyers?collectionId=${activeCollection.id}`}>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    View Buyer Totals
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-4 sm:p-5 sm:pt-4">
              {topBuyers.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {topBuyers.map((buyer) => (
                    <div
                      key={buyer.buyerId}
                      className="rounded-2xl border border-slate-100/80 bg-white/45 px-3.5 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold leading-tight text-slate-900">
                          {buyer.buyerName}
                        </p>
                        <p className="shrink-0 text-sm font-semibold leading-none text-slate-900">
                          {formatCurrency(buyer.totalAmount)}
                        </p>
                      </div>
                        <p className="mt-1 text-[11px] leading-none text-slate-500">
                          {buyer.totalWonItems} {buyer.totalWonItems === 1 ? "item" : "items"}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Total Buyers
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-none text-slate-900">
                        {buyerTotals.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Total Claimed Amount
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-none text-slate-900">
                        {formatCurrency(totalBuyerClaimValue)}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
                  Buyer totals will populate once winning claims have been resolved in the live collection.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-slate-100">
            <CardHeader className="px-4 py-4 sm:px-5">
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] leading-none text-slate-400">
                Live Collection Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
              {liveStatusRows.length > 0 ? (
                liveStatusRows.map((batch) => (
                  <div key={batch.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100/70 bg-white/40 px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight text-slate-900">{batch.title}</p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-500">
                        {batch.claimedItems} claimed of {batch.itemPhotos}
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
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
                  No batch posts have been attached to this collection yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-slate-100">
            <CardHeader className="px-4 py-4 sm:px-5">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-[#7a62b7]" />
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] leading-none text-slate-400">
                  Needs Review
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 pt-0 sm:p-5 sm:pt-0">
              <div className="rounded-2xl border border-slate-100/70 bg-white/40 px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Pending Issues
                </p>
                <p className="mt-1 text-xl font-semibold leading-none text-slate-900">
                  {derivedActiveNeedsReview}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100/70 bg-white/40 px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Manual Fixes Needed
                </p>
                <p className="mt-1 text-xl font-semibold leading-none text-slate-900">
                  {manualFixes}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100/70 bg-white/40 px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Batch Alerts
                </p>
                <p className="mt-1 text-xl font-semibold leading-none text-slate-900">
                  {pendingIssues}
                </p>
              </div>
              <p className="text-[11px] leading-4 text-slate-500">
                Review queue tracks unresolved claim conflicts, manual overrides, and sync attention states.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
