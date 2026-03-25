import Link from "next/link";
import { Download, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { BuyerSearchInput } from "@/components/buyers/BuyerSearchInput";
import { SupabaseConfigGuide } from "@/components/workflow/SupabaseConfigGuide";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { formatClaimWord, formatCurrency, formatDateTime } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase";
import { collectionService } from "@/services/collection.service";
import { BuyerTotalSummary, CollectionListItem } from "@/types";

export default async function BuyersPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    collectionId?: string; 
    buyerId?: string;
    query?: string;
    sortBy?: "name" | "amount" | "items";
    sortOrder?: "asc" | "desc";
  }>;
}) {
  if (!isSupabaseConfigured()) {
    return <SupabaseConfigGuide />;
  }

  let pageError: string | null = null;
  const resolvedSearchParams = await searchParams;
  let collections: CollectionListItem[] = [];

  try {
    collections = await collectionService.getCollections();
  } catch (error) {
    pageError = error instanceof Error ? error.message : "Failed to load collections.";
  }

  const selectedCollectionId =
    resolvedSearchParams.collectionId ??
    collections.find((collection) => collection.status === "open")?.id ??
    collections[0]?.id;
    
  let buyers: BuyerTotalSummary[] = [];
  if (!pageError && selectedCollectionId) {
    try {
      buyers = await collectionService.getBuyerTotals(selectedCollectionId);
    } catch (error) {
      pageError = error instanceof Error ? error.message : "Failed to load buyer totals.";
    }
  }
  const query = resolvedSearchParams.query?.trim() ?? "";
  const normalizedQuery = query.toLocaleLowerCase();
  
  const sortBy = resolvedSearchParams.sortBy ?? "amount";
  const sortOrder = resolvedSearchParams.sortOrder ?? "desc";

  if (normalizedQuery) {
    buyers = buyers.filter((buyer) =>
      buyer.buyerName.toLocaleLowerCase().includes(normalizedQuery) ||
      buyer.collectionName.toLocaleLowerCase().includes(normalizedQuery)
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

  const selectedBuyerId = resolvedSearchParams.buyerId ?? buyers[0]?.buyerId;
  const selectedBuyer = selectedBuyerId
    ? buyers.find((buyer) => buyer.buyerId === selectedBuyerId)
    : undefined;

  const buildBuyersHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();

    const nextCollectionId = overrides.collectionId ?? selectedCollectionId;
    const nextBuyerId = overrides.buyerId ?? resolvedSearchParams.buyerId;
    const nextQuery = overrides.query ?? query;
    const nextSortBy = overrides.sortBy ?? sortBy;
    const nextSortOrder = overrides.sortOrder ?? sortOrder;

    if (nextCollectionId) {
      params.set("collectionId", nextCollectionId);
    }

    if (nextBuyerId) {
      params.set("buyerId", nextBuyerId);
    }

    if (nextQuery) {
      params.set("query", nextQuery);
    }

    if (nextSortBy) {
      params.set("sortBy", nextSortBy);
    }

    if (nextSortOrder) {
      params.set("sortOrder", nextSortOrder);
    }

    return `/buyers?${params.toString()}`;
  };

  return (
    <div className="space-y-4 sm:space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#8b8594]">Core Ledger</p>
          <h1 className="mt-2 text-[30px] font-bold tracking-tight text-[#2b2b2b] sm:text-4xl">Buyer Totals</h1>
          <p className="mt-2 text-[13px] text-[#6b6b6b] sm:text-base">
            Verify buyer totals with thumbnails before sending invoices.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <Button variant="outline" className="w-full sm:w-auto">
            <Printer className="mr-2 h-4 w-4" />
            Print All
          </Button>
          <Button variant="outline" className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:gap-3 sm:overflow-visible">
        {collections.map((collection) => (
          <Link
            key={collection.id}
            href={buildBuyersHref({
              collectionId: collection.id,
              buyerId: undefined,
            })}
            className={`shrink-0 rounded-[16px] border px-3 py-2 text-[13px] font-semibold transition-all sm:rounded-[18px] sm:px-4 sm:py-2.5 sm:text-sm ${
              collection.id === selectedCollectionId
                ? "border-white/60 bg-white/82 text-[#2b2b2b] shadow-[0_12px_24px_rgba(110,91,140,0.1)]"
                : "border-white/50 bg-white/38 text-[#6b6b6b] hover:bg-white/58"
            }`}
          >
            {collection.name}
          </Link>
        ))}
      </div>

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
                  <BuyerSearchInput initialValue={query} />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#8b8594] sm:mr-2 sm:text-xs sm:tracking-[0.22em]">Sort:</span>
                    <Link href={buildBuyersHref({ sortBy: "name", sortOrder: sortBy === "name" && sortOrder === "asc" ? "desc" : "asc", buyerId: undefined })}>
                       <Button variant={sortBy === 'name' ? 'primary' : 'outline'} size="sm" className="h-9">Name</Button>
                    </Link>
                    <Link href={buildBuyersHref({ sortBy: "items", sortOrder: sortBy === "items" && sortOrder === "asc" ? "desc" : "asc", buyerId: undefined })}>
                       <Button variant={sortBy === 'items' ? 'primary' : 'outline'} size="sm" className="h-9">Items</Button>
                    </Link>
                    <Link href={buildBuyersHref({ sortBy: "amount", sortOrder: sortBy === "amount" && sortOrder === "asc" ? "desc" : "asc", buyerId: undefined })}>
                       <Button variant={sortBy === 'amount' ? 'primary' : 'outline'} size="sm" className="h-9">Amount</Button>
                    </Link>
                  </div>
                  <div className="rounded-[16px] bg-white/45 px-3 py-2 text-[13px] font-bold text-[#6b6b6b] sm:rounded-[18px] sm:px-4 sm:py-2.5 sm:text-sm">
                    {buyers.length} buyers
                  </div>
                </div>

              <div className="divide-y divide-white/40">
                {buyers.map((buyer) => (
                  <Link
                    key={buyer.buyerId}
                    href={buildBuyersHref({
                      collectionId: buyer.collectionId,
                      buyerId: buyer.buyerId,
                    })}
                    className="group flex flex-col gap-3 p-4 transition-all hover:bg-white/28 sm:p-6"
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
                  </Link>
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
    </div>
  );
}
