import Link from "next/link";
import { Calendar, ChevronRight, Facebook, Layers, Plus, Search, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { formatCurrency, formatDateRange, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { collectionService } from "@/services/collection.service";

import { DeleteCollectionButton } from "@/components/workflow/DeleteCollectionButton";

function getCollectionBadge(status: string) {
  switch (status) {
    case "open":
      return "emerald";
    case "finalized":
      return "indigo";
    case "locked":
      return "slate";
    default:
      return "amber";
  }
}

export default async function CollectionsPage() {
  const collections = await collectionService.getCollections();
  const collectionDetails = await Promise.all(
    collections.map(async (collection) => ({
      summary: collection,
      detail: await collectionService.getCollection(collection.id),
    })),
  );
  const openCollections = collections.filter((collection) => collection.status === "open").length;
  const totalPhotos = collectionDetails.reduce((sum, { summary, detail }) => {
    if (detail) {
      return sum + detail.batches.reduce((batchSum, batch) => batchSum + batch.items.length, 0);
    }

    return sum + summary.totalItemPhotos;
  }, 0);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/50 bg-white/38">
        <CardContent className="relative p-6 sm:p-7">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[34%] bg-[radial-gradient(circle_at_top,#ffb69f_0%,rgba(255,182,159,0.18)_34%,transparent_70%)] lg:block" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b8594]">Collections</p>
              <h1 className="mt-3 text-[clamp(2.6rem,5vw,4.1rem)] font-semibold leading-[0.94] tracking-[-0.04em] text-[#2b2b2b]">
                Collections
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#69616f]">
                Create collections, sync Facebook batch posts, and track photo-level claims.
              </p>
            </div>

            <div className="flex flex-col gap-3 self-stretch lg:min-w-[360px] lg:max-w-[420px] lg:self-end">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[22px] border border-white/55 bg-white/52 px-4 py-3 shadow-[0_10px_24px_rgba(110,91,140,0.08)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b8594]">Open</p>
                  <p className="mt-1 text-2xl font-semibold leading-none text-[#2b2b2b]">{openCollections}</p>
                </div>
                <div className="rounded-[22px] border border-white/55 bg-white/44 px-4 py-3 shadow-[0_10px_24px_rgba(110,91,140,0.08)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b8594]">Photos</p>
                  <p className="mt-1 text-2xl font-semibold leading-none text-[#2b2b2b]">{totalPhotos}</p>
                </div>
              </div>

              <Link href="/collections/new" className="self-start lg:self-end">
                <Button className="h-12 rounded-[20px] px-6 text-sm font-semibold">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Collection
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-0 bg-white/34">
        <CardContent className="p-5 sm:p-6">
          <div className="rounded-[28px] border border-white/55 bg-white/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] sm:p-5">
            <div className="flex flex-col gap-4 border-b border-white/45 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b8594]">Library</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#2b2b2b]">Your selling collections</h2>
              </div>
              <div className="text-sm text-[#7a7282]">
                {collections.length} {collections.length === 1 ? "collection" : "collections"}
              </div>
            </div>

            <div className="mt-4 flex items-center">
              <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8594]" />
              <input
                type="text"
                placeholder="Search collections..."
                className="w-full rounded-[18px] border border-white/60 bg-white/72 py-3 pl-10 pr-4 text-sm text-[#4f4a57] shadow-[0_10px_22px_rgba(110,91,140,0.08)] placeholder:text-[#978fa0]"
              />
            </div>
            </div>

            <div className="mt-5 space-y-4">
              {collectionDetails.map(({ summary, detail }) => {
                const detailItems = detail ? detail.batches.flatMap((batch) => batch.items) : [];
                const totalItemPhotos = detail ? detailItems.length : summary.totalItemPhotos;
                const totalClaimedItems = detail
                  ? detailItems.filter((item) =>
                      item.status === "claimed" || item.status === "manual_override" || item.status === "locked",
                    ).length
                  : summary.totalClaimedItems;
                const needsReviewCount = detail
                  ? detailItems.filter((item) => item.status === "needs_review").length
                  : summary.needsReviewCount;
                const totalCollectionValue = detail
                  ? detailItems.reduce((sum, item) => {
                      if (
                        item.resolvedPrice === null ||
                        !["claimed", "manual_override", "locked"].includes(item.status)
                      ) {
                        return sum;
                      }

                      return sum + item.resolvedPrice;
                    }, 0)
                  : summary.totalCollectionValue;
                const totalBatchPosts = detail ? detail.batches.length : summary.totalBatchPosts;
                const progress =
                  totalItemPhotos === 0
                    ? 0
                    : Math.round((totalClaimedItems / totalItemPhotos) * 100);

                return (
                  <Link
                    key={summary.id}
                    href={`/collections/${summary.id}`}
                    className="group block rounded-[28px] border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(255,255,255,0.42))] p-5 shadow-[0_16px_34px_rgba(110,91,140,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(255,255,255,0.5))] hover:shadow-[0_20px_40px_rgba(110,91,140,0.12)]"
                  >
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.9fr)]">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0.5))] text-[#7a62b7] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_12px_26px_rgba(110,91,140,0.08)] ring-1 ring-white/60 transition-colors group-hover:text-[#ff8e6e]">
                          <Calendar className="h-7 w-7" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="truncate text-[28px] font-semibold tracking-[-0.04em] text-[#2b2b2b] transition-colors group-hover:text-[#7a62b7]">
                              {summary.name}
                            </h3>
                            <StatusBadge
                              label={summary.status}
                              variant={getCollectionBadge(summary.status) as "emerald" | "indigo" | "slate" | "amber"}
                            />
                          </div>

                          <p className="mt-1 text-sm text-[#6f6776]">
                            {formatDateRange(summary.startDate, summary.endDate)}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2.5 text-xs font-medium text-[#655d6b]">
                            <div className="flex items-center gap-2 rounded-full border border-white/55 bg-white/52 px-3 py-2 shadow-[0_8px_18px_rgba(110,91,140,0.06)]">
                              <Facebook className="h-3.5 w-3.5 text-blue-500" />
                              <span className="max-w-[220px] truncate">{summary.connectedFacebookPage}</span>
                            </div>
                            <div className="flex items-center gap-2 rounded-full border border-white/55 bg-white/44 px-3 py-2">
                              <Layers className="h-3.5 w-3.5 text-[#8b8594]" />
                              <span>{totalBatchPosts} batches</span>
                            </div>
                            <div className="flex items-center gap-2 rounded-full border border-white/55 bg-white/44 px-3 py-2">
                              <ShoppingBag className="h-3.5 w-3.5 text-[#8b8594]" />
                              <span>{totalItemPhotos} photos</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                        <div className="rounded-[22px] border border-white/55 bg-white/40 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b8594]">
                                Claim activity
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-semibold text-[#4f9274]">{totalClaimedItems} claimed</span>
                                <span className="text-white/60">/</span>
                                <span className="font-semibold text-[#c67a49]">{needsReviewCount} review</span>
                              </div>
                            </div>
                            <p className="text-right text-[24px] font-semibold leading-none text-[#2b2b2b]">
                              {progress}
                              <span className="ml-1 text-sm text-[#8b8594]">%</span>
                            </p>
                          </div>
                          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/55">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,#8ecfb5,#b79cf5)]"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                          <div className="rounded-[20px] border border-white/55 bg-white/44 px-4 py-3 text-left shadow-[0_8px_18px_rgba(110,91,140,0.06)] sm:text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b8594]">
                              Value
                            </p>
                            <p className="mt-1 text-lg font-semibold text-[#2b2b2b]">
                              {formatCurrency(totalCollectionValue)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="text-left sm:text-right">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b8594]">
                                Finalize
                              </p>
                              <p
                                className={cn(
                                  "mt-1 text-sm font-semibold",
                                  summary.finalizeDate ? "text-[#2b2b2b]" : "text-[#8b8594]",
                                )}
                              >
                                {summary.finalizeDate ? formatShortDate(summary.finalizeDate) : "Not yet"}
                              </p>
                            </div>
                            <DeleteCollectionButton
                              collectionId={summary.id}
                              collectionName={summary.name}
                            />
                            <ChevronRight className="h-5 w-5 text-[#b6a8cb] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#7a62b7]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
