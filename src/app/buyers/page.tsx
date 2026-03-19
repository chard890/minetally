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

  const resolvedSearchParams = await searchParams;
  const collections = await collectionService.getCollections();
  const selectedCollectionId =
    resolvedSearchParams.collectionId ??
    collections.find((collection) => collection.status === "open")?.id ??
    collections[0]?.id;
    
  let buyers = selectedCollectionId ? await collectionService.getBuyerTotals(selectedCollectionId) : [];
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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#8b8594]">Core Ledger</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#2b2b2b]">Buyer Totals</h1>
          <p className="mt-2 text-[#6b6b6b]">
            Verify buyer totals with thumbnails before sending invoices.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Print All
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {collections.map((collection) => (
          <Link
            key={collection.id}
            href={buildBuyersHref({
              collectionId: collection.id,
              buyerId: undefined,
            })}
            className={`rounded-[18px] border px-4 py-2.5 text-sm font-semibold transition-all ${
              collection.id === selectedCollectionId
                ? "border-white/60 bg-white/82 text-[#2b2b2b] shadow-[0_12px_24px_rgba(110,91,140,0.1)]"
                : "border-white/50 bg-white/38 text-[#6b6b6b] hover:bg-white/58"
            }`}
          >
            {collection.name}
          </Link>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden border-0">
            <CardContent className="p-0">
                <div className="flex items-center gap-4 border-b border-white/45 p-6">
                  <BuyerSearchInput initialValue={query} />
                  <div className="flex items-center gap-2">
                    <span className="mr-2 text-xs font-black uppercase tracking-[0.22em] text-[#8b8594]">Sort:</span>
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
                  <div className="rounded-[18px] bg-white/45 px-4 py-2.5 text-sm font-bold text-[#6b6b6b]">
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
                    className="group flex items-center justify-between p-6 transition-all hover:bg-white/28"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/55 bg-white/65 text-sm font-bold text-[#7a62b7]">
                        {buyer.buyerName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-[#2b2b2b] transition-colors group-hover:text-[#7a62b7]">
                          {buyer.buyerName}
                        </h3>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8b8594]">
                          {buyer.collectionName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-8">
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8b8594]">
                          Total Won Items
                        </p>
                        <p className="text-sm font-black text-[#2b2b2b]">{buyer.totalWonItems}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8b8594]">
                          Total Amount
                        </p>
                        <p className="text-sm font-black text-[#2b2b2b]">
                          {formatCurrency(buyer.totalAmount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge
                          label={buyer.collectionStatus}
                          variant={buyer.collectionStatus === "open" ? "emerald" : buyer.collectionStatus === "finalized" ? "indigo" : "slate"}
                        />
                        <Button variant="outline" size="sm">
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

        <div className="space-y-6">
          <Card className="sticky top-8 overflow-hidden border-0">
            <CardHeader className="bg-[linear-gradient(135deg,rgba(255,142,110,0.9),rgba(183,156,245,0.92))] p-6 text-white">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
                  {selectedBuyer?.buyerName.charAt(0) ?? "?"}
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">
                    {selectedBuyer?.buyerName ?? "Select a buyer"}
                  </CardTitle>
                  <CardDescription className="text-xs text-white/75">
                    Winner breakdown
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              {selectedBuyer ? (
                <>
                  <div className="glass-section flex items-center justify-between rounded-[24px] p-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8b8594]">
                        Collection Status
                      </p>
                      <p className="mt-1 text-sm font-bold text-[#2b2b2b]">
                        {selectedBuyer.collectionName}
                      </p>
                    </div>
                    <StatusBadge
                      label={selectedBuyer.collectionStatus}
                      variant={selectedBuyer.collectionStatus === "open" ? "emerald" : selectedBuyer.collectionStatus === "finalized" ? "indigo" : "slate"}
                    />
                  </div>

                  <div>
                    <p className="mb-3 px-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#8b8594]">
                      Won items ({selectedBuyer.totalWonItems})
                    </p>
                    <div className="soft-scrollbar max-h-[420px] space-y-3 overflow-y-auto pr-2">
                      {selectedBuyer.items.map((item) => (
                        <Link
                          key={item.itemId}
                          href={`/collections/${selectedBuyer.collectionId}/items/${item.itemId}`}
                          className="glass-section group flex items-center space-x-4 rounded-[22px] p-3"
                        >
                          <div className="h-14 w-14 overflow-hidden rounded-xl shadow-sm">
                            <img src={item.thumbnailUrl} alt={`Item ${item.itemNumber}`} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-black text-[#2b2b2b]">
                                Item #{String(item.itemNumber).padStart(2, "0")}
                              </p>
                              <p className="text-xs font-black text-[#2b2b2b]">
                                {formatCurrency(item.resolvedPrice)}
                              </p>
                            </div>
                            <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.22em] text-[#8b8594]">
                              {item.batchTitle}
                            </p>
                            <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.22em] text-[#8b8594]">
                              <span>{formatClaimWord(item.claimWord)}</span>
                              <span>{formatDateTime(item.claimedAt)}</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-white/45 pt-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-[#6b6b6b]">Subtotal</p>
                      <p className="text-sm font-black text-[#2b2b2b]">
                        {formatCurrency(selectedBuyer.totalAmount)}
                      </p>
                    </div>
                    <Button className="h-12 w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download Invoice
                    </Button>
                    <Button
                      variant="outline"
                      className="h-12 w-full"
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
