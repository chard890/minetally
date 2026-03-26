"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { formatClaimWord, formatCurrency, formatDateTime } from "@/lib/format";
import { BuyerTotalSummary, CollectionListItem } from "@/types";

type BuyerSortBy = "name" | "amount" | "items";
type BuyerSortOrder = "asc" | "desc";

type BuyerTotalsClientProps = {
  buyers: BuyerTotalSummary[];
  collections: CollectionListItem[];
  pageError: string | null;
  selectedCollectionId?: string;
  initialBuyerId?: string;
  initialQuery: string;
  initialSortBy: BuyerSortBy;
  initialSortOrder: BuyerSortOrder;
  buildCollectionHref: (collectionId: string) => string;
};

export function BuyerTotalsClient({
  buyers: initialBuyers,
  collections,
  pageError,
  selectedCollectionId,
  initialBuyerId,
  initialQuery,
  initialSortBy,
  initialSortOrder,
  buildCollectionHref,
}: BuyerTotalsClientProps) {
  const [query, setQuery] = useState(initialQuery);
  const [sortBy, setSortBy] = useState<BuyerSortBy>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<BuyerSortOrder>(initialSortOrder);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | undefined>(initialBuyerId);

  useEffect(() => {
    setQuery(initialQuery);
    setSortBy(initialSortBy);
    setSortOrder(initialSortOrder);
    setSelectedBuyerId(initialBuyerId);
  }, [initialBuyerId, initialQuery, initialSortBy, initialSortOrder, initialBuyers]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  let buyers = initialBuyers;

  if (normalizedQuery) {
    buyers = buyers.filter((buyer) =>
      buyer.buyerName.toLocaleLowerCase().includes(normalizedQuery)
      || buyer.collectionName.toLocaleLowerCase().includes(normalizedQuery),
    );
  }

  buyers = [...buyers].sort((a, b) => {
    let comparison = 0;

    if (sortBy === "name") {
      comparison = a.buyerName.localeCompare(b.buyerName);
    } else if (sortBy === "items") {
      comparison = a.totalWonItems - b.totalWonItems;
    } else {
      comparison = a.totalAmount - b.totalAmount;
    }

    return sortOrder === "asc" ? comparison : -comparison;
  });

  const selectedBuyer =
    (selectedBuyerId ? buyers.find((buyer) => buyer.buyerId === selectedBuyerId) : undefined)
    ?? buyers[0];

  const handleSort = (nextSortBy: BuyerSortBy) => {
    if (sortBy === nextSortBy) {
      setSortOrder((currentSortOrder) => (currentSortOrder === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(nextSortBy);
    setSortOrder(nextSortBy === "name" ? "asc" : "desc");
  };

  return (
    <div className="grid gap-4 sm:gap-8 lg:grid-cols-3">
      <div className="space-y-4 sm:space-y-6 lg:col-span-2">
        <Card className="overflow-hidden border-0">
          <CardContent className="p-0">
            {pageError ? (
              <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:px-6">
                Buyer totals could not be loaded: {pageError}
              </div>
            ) : null}
            <div className="flex flex-col gap-3 border-b border-white/45 p-4 sm:p-6">
              <div className="relative flex-1">
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search buyers..."
                  aria-label="Search buyers"
                  className="w-full py-2.5 pl-4 pr-4 text-sm font-medium"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#8b8594] sm:mr-2 sm:text-xs sm:tracking-[0.22em]">Sort:</span>
                <Button variant={sortBy === "name" ? "primary" : "outline"} size="sm" className="h-9" onClick={() => handleSort("name")}>Name</Button>
                <Button variant={sortBy === "items" ? "primary" : "outline"} size="sm" className="h-9" onClick={() => handleSort("items")}>Items</Button>
                <Button variant={sortBy === "amount" ? "primary" : "outline"} size="sm" className="h-9" onClick={() => handleSort("amount")}>Amount</Button>
              </div>
              <div className="rounded-[16px] bg-white/45 px-3 py-2 text-[13px] font-bold text-[#6b6b6b] sm:rounded-[18px] sm:px-4 sm:py-2.5 sm:text-sm">
                {buyers.length} buyers
              </div>
            </div>

            <div className="divide-y divide-white/40">
              {buyers.map((buyer) => (
                <button
                  key={buyer.buyerId}
                  type="button"
                  onClick={() => setSelectedBuyerId(buyer.buyerId)}
                  className="group flex w-full flex-col gap-3 p-4 text-left transition-all hover:bg-white/28 sm:p-6"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/55 bg-white/65 text-sm font-bold text-[#7a62b7] sm:h-11 sm:w-11">
                      {buyer.buyerName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-[#2b2b2b] transition-colors group-hover:text-[#7a62b7] sm:text-xl">
                        {buyer.buyerName}
                      </h3>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8b8594]">
                        {buyer.collectionName}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:flex sm:items-center sm:space-x-8">
                    <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-8">
                      <div className="rounded-[16px] border border-white/45 bg-white/35 px-3 py-2.5 text-left sm:border-0 sm:bg-transparent sm:p-0 sm:text-right">
                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#8b8594] sm:text-[10px] sm:tracking-[0.22em]">
                          Total Won Items
                        </p>
                        <p className="text-sm font-black text-[#2b2b2b]">{buyer.totalWonItems}</p>
                      </div>
                      <div className="rounded-[16px] border border-white/45 bg-white/35 px-3 py-2.5 text-left sm:border-0 sm:bg-transparent sm:p-0 sm:text-right">
                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#8b8594] sm:text-[10px] sm:tracking-[0.22em]">
                          Total Amount
                        </p>
                        <p className="text-sm font-black text-[#2b2b2b]">
                          {formatCurrency(buyer.totalAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <StatusBadge
                        label={buyer.collectionStatus}
                        variant={buyer.collectionStatus === "open" ? "emerald" : buyer.collectionStatus === "finalized" ? "indigo" : "slate"}
                      />
                      <Button variant="outline" size="sm" className="h-8 px-3 text-[11px] sm:h-9 sm:px-3.5 sm:text-xs">
                        View Items
                      </Button>
                    </div>
                  </div>
                </button>
              ))}
              {buyers.length === 0 ? (
                <div className="p-10 text-center text-sm font-medium text-[#6b6b6b]">
                  No buyers match{query ? ` "${query}"` : " your search"}.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <Card className="overflow-hidden border-0 lg:sticky lg:top-8">
          <CardHeader className="bg-[linear-gradient(135deg,rgba(255,142,110,0.9),rgba(183,156,245,0.92))] p-4 text-white sm:p-6">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-base font-bold text-white sm:h-12 sm:w-12 sm:text-lg">
                {selectedBuyer?.buyerName.charAt(0) ?? "?"}
              </div>
              <div>
                <CardTitle className="text-base font-bold sm:text-lg">
                  {selectedBuyer?.buyerName ?? "Select a buyer"}
                </CardTitle>
                <CardDescription className="text-xs text-white/75">
                  Winner breakdown
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:space-y-5 sm:p-6">
            {selectedBuyer ? (
              <>
                <div className="glass-section flex items-center justify-between rounded-[18px] p-3 sm:rounded-[24px] sm:p-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#8b8594] sm:text-[10px] sm:tracking-[0.22em]">
                      Collection Status
                    </p>
                    <p className="mt-1 text-[13px] font-bold text-[#2b2b2b] sm:text-sm">
                      {selectedBuyer.collectionName}
                    </p>
                  </div>
                  <StatusBadge
                    label={selectedBuyer.collectionStatus}
                    variant={selectedBuyer.collectionStatus === "open" ? "emerald" : selectedBuyer.collectionStatus === "finalized" ? "indigo" : "slate"}
                  />
                </div>

                <div>
                  <p className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#8b8594] sm:mb-3 sm:text-[10px] sm:tracking-[0.22em]">
                    Won items ({selectedBuyer.totalWonItems})
                  </p>
                  <div className="soft-scrollbar max-h-[420px] space-y-2.5 overflow-y-auto pr-1 sm:space-y-3 sm:pr-2">
                    {selectedBuyer.items.map((item) => (
                      <Link
                        key={item.itemId}
                        href={`/collections/${selectedBuyer.collectionId}/items/${item.itemId}`}
                        className="glass-section group flex items-center space-x-3 rounded-[18px] p-2.5 sm:space-x-4 sm:rounded-[22px] sm:p-3"
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-sm sm:h-14 sm:w-14">
                          <img src={item.thumbnailUrl} alt={`Item ${item.itemNumber}`} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-black text-[#2b2b2b] sm:text-xs">
                              Item #{String(item.itemNumber).padStart(2, "0")}
                            </p>
                            <p className="text-[11px] font-black text-[#2b2b2b] sm:text-xs">
                              {formatCurrency(item.resolvedPrice)}
                            </p>
                          </div>
                          <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.18em] text-[#8b8594] sm:text-[10px] sm:tracking-[0.22em]">
                            {item.batchTitle}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-[#8b8594] sm:text-[10px] sm:tracking-[0.22em]">
                            <span>{formatClaimWord(item.claimWord)}</span>
                            <span>{formatDateTime(item.claimedAt)}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 border-t border-white/45 pt-4 sm:pt-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-bold text-[#6b6b6b] sm:text-sm">Subtotal</p>
                    <p className="text-[13px] font-black text-[#2b2b2b] sm:text-sm">
                      {formatCurrency(selectedBuyer.totalAmount)}
                    </p>
                  </div>
                  <Button className="h-11 w-full sm:h-12">
                    <Download className="mr-2 h-4 w-4" />
                    Download Invoice
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 w-full sm:h-12"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Message Buyer
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm font-medium text-[#6b6b6b]">
                No buyer selected for this collection.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
