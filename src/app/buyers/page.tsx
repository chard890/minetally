import Link from "next/link";
import { Download, ExternalLink, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { formatClaimWord, formatCurrency, formatDateTime } from "@/lib/format";
import { collectionService } from "@/services/collection.service";

export default async function BuyersPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    collectionId?: string; 
    buyerId?: string;
    sortBy?: "name" | "amount" | "items";
    sortOrder?: "asc" | "desc";
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const collections = await collectionService.getCollections();
  const selectedCollectionId =
    resolvedSearchParams.collectionId ??
    collections.find((collection) => collection.status === "open")?.id ??
    collections[0]?.id;
    
  let buyers = selectedCollectionId ? await collectionService.getBuyerTotals(selectedCollectionId) : [];
  
  // Sorting logic based on searchParams
  const sortBy = resolvedSearchParams.sortBy ?? "amount";
  const sortOrder = resolvedSearchParams.sortOrder ?? "desc";

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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Buyer Totals</h1>
          <p className="mt-1 text-slate-500">
            Verify buyer totals with thumbnails before sending invoices.
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" className="rounded-xl border-slate-200">
            <Printer className="mr-2 h-4 w-4" />
            Print All
          </Button>
          <Button variant="outline" className="rounded-xl border-slate-200">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {collections.map((collection) => (
          <Link
            key={collection.id}
            href={`/buyers?collectionId=${collection.id}`}
            className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
              collection.id === selectedCollectionId
                ? "border-indigo-100 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {collection.name}
          </Link>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden rounded-2xl border-0 shadow-sm ring-1 ring-slate-100">
            <CardContent className="p-0">
                <div className="flex items-center gap-4 border-b border-slate-50 bg-white p-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search buyers..."
                      className="w-full rounded-xl border-0 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 mr-2">Sort:</span>
                    <Link href={`/buyers?collectionId=${selectedCollectionId}&sortBy=name&sortOrder=${sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc'}`}>
                       <Button variant={sortBy === 'name' ? 'primary' : 'outline'} size="sm" className="rounded-xl h-9 font-bold">Name</Button>
                    </Link>
                    <Link href={`/buyers?collectionId=${selectedCollectionId}&sortBy=items&sortOrder=${sortBy === 'items' && sortOrder === 'asc' ? 'desc' : 'asc'}`}>
                       <Button variant={sortBy === 'items' ? 'primary' : 'outline'} size="sm" className="rounded-xl h-9 font-bold">Items</Button>
                    </Link>
                    <Link href={`/buyers?collectionId=${selectedCollectionId}&sortBy=amount&sortOrder=${sortBy === 'amount' && sortOrder === 'asc' ? 'desc' : 'asc'}`}>
                       <Button variant={sortBy === 'amount' ? 'primary' : 'outline'} size="sm" className="rounded-xl h-9 font-bold">Amount</Button>
                    </Link>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600">
                    {buyers.length} buyers
                  </div>
                </div>

              <div className="divide-y divide-slate-50">
                {buyers.map((buyer) => (
                  <Link
                    key={buyer.buyerId}
                    href={`/buyers?collectionId=${buyer.collectionId}&buyerId=${buyer.buyerId}`}
                    className="group flex items-center justify-between p-6 transition-all hover:bg-slate-50/50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 text-sm font-bold text-indigo-600">
                        {buyer.buyerName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 transition-colors group-hover:text-indigo-600">
                          {buyer.buyerName}
                        </h3>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {buyer.collectionName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-8">
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          Total Won Items
                        </p>
                        <p className="text-sm font-black text-slate-900">{buyer.totalWonItems}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          Total Amount
                        </p>
                        <p className="text-sm font-black text-slate-900">
                          {formatCurrency(buyer.totalAmount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge
                          label={buyer.collectionStatus}
                          variant={buyer.collectionStatus === "open" ? "emerald" : buyer.collectionStatus === "finalized" ? "indigo" : "slate"}
                        />
                        <Button variant="outline" size="sm" className="rounded-xl font-bold">
                          View Items
                        </Button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-8 overflow-hidden rounded-3xl border-0 bg-white shadow-xl ring-1 ring-slate-100">
            <CardHeader className="bg-slate-900 p-6 text-white">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-lg font-bold text-slate-100">
                  {selectedBuyer?.buyerName.charAt(0) ?? "?"}
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">
                    {selectedBuyer?.buyerName ?? "Select a buyer"}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Winner breakdown
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              {selectedBuyer ? (
                <>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Collection Status
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {selectedBuyer.collectionName}
                      </p>
                    </div>
                    <StatusBadge
                      label={selectedBuyer.collectionStatus}
                      variant={selectedBuyer.collectionStatus === "open" ? "emerald" : selectedBuyer.collectionStatus === "finalized" ? "indigo" : "slate"}
                    />
                  </div>

                  <div>
                    <p className="mb-3 px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Won items ({selectedBuyer.totalWonItems})
                    </p>
                    <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
                      {selectedBuyer.items.map((item) => (
                        <Link
                          key={item.itemId}
                          href={`/collections/${selectedBuyer.collectionId}/items/${item.itemId}`}
                          className="group flex items-center space-x-4 rounded-2xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:border-indigo-100"
                        >
                          <div className="h-14 w-14 overflow-hidden rounded-xl shadow-sm">
                            <img src={item.thumbnailUrl} alt={`Item ${item.itemNumber}`} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-black text-slate-900">
                                Item #{String(item.itemNumber).padStart(2, "0")}
                              </p>
                              <p className="text-xs font-black text-slate-900">
                                {formatCurrency(item.resolvedPrice)}
                              </p>
                            </div>
                            <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              {item.batchTitle}
                            </p>
                            <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              <span>{formatClaimWord(item.claimWord)}</span>
                              <span>{formatDateTime(item.claimedAt)}</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-slate-100 pt-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-500">Subtotal</p>
                      <p className="text-sm font-black text-slate-900">
                        {formatCurrency(selectedBuyer.totalAmount)}
                      </p>
                    </div>
                    <Button className="h-12 w-full rounded-xl bg-indigo-600 font-bold shadow-lg shadow-indigo-100">
                      <Download className="mr-2 h-4 w-4" />
                      Download Invoice
                    </Button>
                    <Button
                      variant="outline"
                      className="h-12 w-full rounded-xl border-indigo-100 font-bold text-indigo-600 hover:bg-indigo-50"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Message Buyer
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm font-medium text-slate-500">
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
