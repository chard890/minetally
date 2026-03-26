import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { BuyersDashboard } from "@/components/buyers/BuyersDashboard";
import { BuyerSearchInput } from "@/components/buyers/BuyerSearchInput";
import { SupabaseConfigGuide } from "@/components/workflow/SupabaseConfigGuide";
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
          <form action="/api/buyers/export" method="get" className="w-full sm:w-auto">
            <input type="hidden" name="collectionId" value={selectedCollectionId ?? ""} />
            <Button variant="outline" className="w-full sm:w-auto" type="submit">
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </form>
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

      <div className="space-y-4 sm:space-y-6">
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
                  <Button variant={sortBy === "name" ? "primary" : "outline"} size="sm" className="h-9">Name</Button>
                </Link>
                <Link href={buildBuyersHref({ sortBy: "items", sortOrder: sortBy === "items" && sortOrder === "asc" ? "desc" : "asc", buyerId: undefined })}>
                  <Button variant={sortBy === "items" ? "primary" : "outline"} size="sm" className="h-9">Items</Button>
                </Link>
                <Link href={buildBuyersHref({ sortBy: "amount", sortOrder: sortBy === "amount" && sortOrder === "asc" ? "desc" : "asc", buyerId: undefined })}>
                  <Button variant={sortBy === "amount" ? "primary" : "outline"} size="sm" className="h-9">Amount</Button>
                </Link>
              </div>
              <div className="rounded-[16px] bg-white/45 px-3 py-2 text-[13px] font-bold text-[#6b6b6b] sm:rounded-[18px] sm:px-4 sm:py-2.5 sm:text-sm">
                {buyers.length} buyers
              </div>
            </div>
          </CardContent>
        </Card>

        <BuyersDashboard buyers={buyers} initialSelectedBuyerId={selectedBuyerId} />
      </div>
    </div>
  );
}
