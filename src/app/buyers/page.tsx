import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BuyerTotalsClient } from "@/components/buyers/BuyerTotalsClient";
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
  const sortBy = resolvedSearchParams.sortBy ?? "amount";
  const sortOrder = resolvedSearchParams.sortOrder ?? "desc";

  const buildBuyersHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();

    const nextCollectionId = overrides.collectionId ?? selectedCollectionId;

    if (nextCollectionId) {
      params.set("collectionId", nextCollectionId);
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

      <BuyerTotalsClient
        buyers={buyers}
        pageError={pageError}
        initialBuyerId={resolvedSearchParams.buyerId}
        initialQuery={query}
        initialSortBy={sortBy}
        initialSortOrder={sortOrder}
      />
    </div>
  );
}
