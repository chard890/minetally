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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Collections</h1>
          <p className="mt-1 text-slate-500">
            Create collections, sync Facebook batch posts, and track photo-level claims.
          </p>
        </div>
        <Link href="/collections/new">
          <Button className="bg-indigo-600 shadow-lg shadow-indigo-100 ring-1 ring-indigo-500/20">
            <Plus className="mr-2 h-4 w-4" />
            Create Collection
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-slate-100">
        <CardContent className="p-0">
          <div className="flex items-center border-b border-slate-50 bg-white p-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search collections..."
                className="w-full rounded-xl border-0 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium transition-all focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-50">
            {collections.map((collection) => {
              const progress =
                collection.totalItemPhotos === 0
                  ? 0
                  : Math.round((collection.totalClaimedItems / collection.totalItemPhotos) * 100);

              return (
                <Link
                  key={collection.id}
                  href={`/collections/${collection.id}`}
                  className="group flex items-center justify-between p-6 transition-all hover:bg-slate-50/50"
                >
                  <div className="flex items-center space-x-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 transition-colors group-hover:bg-indigo-100">
                      <Calendar className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-bold text-slate-900 transition-colors group-hover:text-indigo-600">
                          {collection.name}
                        </h3>
                        <StatusBadge
                          label={collection.status}
                          variant={getCollectionBadge(collection.status) as "emerald" | "indigo" | "slate" | "amber"}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center space-x-4 text-xs font-medium text-slate-500">
                        <div className="flex items-center whitespace-nowrap">
                          <Calendar className="mr-1.5 h-3 w-3 text-slate-400" />
                          {formatDateRange(collection.startDate, collection.endDate)}
                        </div>
                        <div className="flex items-center whitespace-nowrap">
                          <Facebook className="mr-1.5 h-3 w-3 text-blue-500" />
                          {collection.connectedFacebookPage}
                        </div>
                        <div className="flex items-center whitespace-nowrap">
                          <Layers className="mr-1.5 h-3 w-3 text-slate-400" />
                          {collection.totalBatchPosts} batches
                        </div>
                        <div className="flex items-center whitespace-nowrap">
                          <ShoppingBag className="mr-1.5 h-3 w-3 text-slate-400" />
                          {collection.totalItemPhotos} photos
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-8">
                    <div className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <span className="text-sm font-bold text-emerald-600">
                          {collection.totalClaimedItems} claimed
                        </span>
                        <span className="text-sm text-slate-300">/</span>
                        <span className="text-sm font-bold text-amber-600">
                          {collection.needsReviewCount} review
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Value {formatCurrency(collection.totalCollectionValue)}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Finalize Date
                          </p>
                          <p className={cn("text-sm font-bold", collection.finalizeDate ? "text-slate-900" : "text-slate-400")}>
                            {collection.finalizeDate ? formatShortDate(collection.finalizeDate) : "Not yet"}
                          </p>
                        </div>
                        <DeleteCollectionButton 
                          collectionId={collection.id} 
                          collectionName={collection.name} 
                        />
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-indigo-400" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
