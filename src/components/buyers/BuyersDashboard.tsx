"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Download, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { formatClaimWord, formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BuyerTotalSummary } from "@/types";

type BuyersDashboardProps = {
  buyers: BuyerTotalSummary[];
  initialSelectedBuyerId?: string;
};

const getCollectionStatusVariant = (status: BuyerTotalSummary["collectionStatus"]) => {
  if (status === "open") {
    return "emerald";
  }

  if (status === "finalized") {
    return "indigo";
  }

  return "slate";
};

export function BuyersDashboard({
  buyers,
  initialSelectedBuyerId,
}: BuyersDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeBuyerId, setActiveBuyerId] = useState(initialSelectedBuyerId ?? buyers[0]?.buyerId);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isDrawerOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!isDrawerOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen]);

  const selectedBuyerId =
    activeBuyerId && buyers.some((buyer) => buyer.buyerId === activeBuyerId)
      ? activeBuyerId
      : initialSelectedBuyerId && buyers.some((buyer) => buyer.buyerId === initialSelectedBuyerId)
        ? initialSelectedBuyerId
        : buyers[0]?.buyerId;

  const selectedBuyer = useMemo(
    () => buyers.find((buyer) => buyer.buyerId === selectedBuyerId),
    [buyers, selectedBuyerId],
  );

  const syncBuyerIdInUrl = (buyerId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("buyerId", buyerId);
    const nextUrl = `${pathname}?${params.toString()}`;

    router.replace(nextUrl, { scroll: false });
  };

  const handleSelectBuyer = (buyerId: string) => {
    setActiveBuyerId(buyerId);
    syncBuyerIdInUrl(buyerId);
  };

  const handleOpenDrawer = (buyerId: string) => {
    handleSelectBuyer(buyerId);
    setIsDrawerOpen(true);
  };

  const detailContent = selectedBuyer ? (
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
          variant={getCollectionStatusVariant(selectedBuyer.collectionStatus)}
        />
      </div>

      <div>
        <p className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#8b8594] sm:mb-3 sm:text-[10px] sm:tracking-[0.22em]">
          Won items ({selectedBuyer.totalWonItems})
        </p>
        <div className="space-y-2.5 pr-1 sm:soft-scrollbar sm:max-h-[420px] sm:space-y-3 sm:overflow-y-auto sm:pr-2">
          {selectedBuyer.items.map((item) => (
            <Link
              key={item.itemId}
              href={`/collections/${selectedBuyer.collectionId}/items/${item.itemId}`}
              className="glass-section group flex items-center space-x-3 rounded-[18px] p-2.5 sm:space-x-4 sm:rounded-[22px] sm:p-3"
              onClick={() => setIsDrawerOpen(false)}
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-sm sm:h-14 sm:w-14">
                <img src={item.thumbnailUrl} alt={`Item ${item.itemNumber}`} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
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
                <div className="mt-2 flex items-center justify-between gap-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[#8b8594] sm:text-[10px] sm:tracking-[0.22em]">
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
  );

  return (
    <>
      <div className="grid gap-4 sm:gap-8 lg:grid-cols-3">
        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          <Card className="overflow-hidden border-0">
            <CardContent className="p-0">
              <div className="divide-y divide-white/40">
                {buyers.map((buyer) => {
                  const isSelected = buyer.buyerId === selectedBuyerId;

                  return (
                    <div
                      key={buyer.buyerId}
                      className={cn(
                        "flex flex-col gap-3 p-4 transition-all sm:p-6",
                        isSelected ? "bg-white/30" : "hover:bg-white/28",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectBuyer(buyer.buyerId)}
                        className="group flex items-start gap-3 text-left sm:gap-4"
                      >
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
                      </button>

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
                            variant={getCollectionStatusVariant(buyer.collectionStatus)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-[11px] sm:h-9 sm:px-3.5 sm:text-xs"
                            onClick={() => handleOpenDrawer(buyer.buyerId)}
                          >
                            View Items
                            <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {buyers.length === 0 ? (
                  <div className="p-10 text-center text-sm font-medium text-[#6b6b6b]">
                    No buyers match your search.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="hidden space-y-4 sm:space-y-6 lg:block">
          <Card className="overflow-hidden border-0 lg:sticky lg:top-8">
            <CardHeader className="bg-[linear-gradient(135deg,rgba(255,142,110,0.9),rgba(183,156,245,0.92))] p-4 text-white sm:p-6">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-base font-bold text-white sm:h-12 sm:w-12 sm:text-lg">
                  {selectedBuyer?.buyerName.charAt(0) ?? "?"}
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-white sm:text-lg">
                    {selectedBuyer?.buyerName ?? "Select a buyer"}
                  </CardTitle>
                  <CardDescription className="text-xs text-white/75">
                    Winner breakdown
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:space-y-5 sm:p-6">
              {detailContent}
            </CardContent>
          </Card>
        </div>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-[70] bg-[#2b2b2b]/35 transition-opacity duration-200 lg:hidden",
          isDrawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsDrawerOpen(false)}
        aria-hidden={!isDrawerOpen}
      />
      <aside
        className={cn(
          "fixed inset-x-3 top-[max(4.5rem,env(safe-area-inset-top)+1rem)] bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[80] mx-auto flex w-[min(100%-1.5rem,28rem)] flex-col overflow-hidden rounded-[30px] border border-white/60 bg-[#f6f1ea] shadow-[0_24px_60px_rgba(43,43,43,0.22)] transition-all duration-300 ease-out lg:hidden",
          isDrawerOpen ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-[0.98] opacity-0",
        )}
        role="dialog"
        aria-modal="true"
        aria-hidden={!isDrawerOpen}
      >
        <div className="flex h-full flex-col">
          <div className="bg-[linear-gradient(135deg,rgba(255,142,110,0.96),rgba(183,156,245,0.96))] px-4 pb-5 pt-4 text-white">
            <div className="flex items-start gap-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 h-10 w-10 shrink-0 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close buyer details"
              >
                <X className="h-5 w-5" />
              </Button>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-base font-bold text-white">
                  {selectedBuyer?.buyerName.charAt(0) ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/75">
                    Winner breakdown
                  </p>
                  <h2 className="truncate text-lg font-bold">
                    {selectedBuyer?.buyerName ?? "Select a buyer"}
                  </h2>
                </div>
              </div>
            </div>
          </div>
          <div className="soft-scrollbar flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <div className="space-y-4">
              {detailContent}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
