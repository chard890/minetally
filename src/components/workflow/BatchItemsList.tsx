
"use client";

import { useState, useMemo } from "react";
import { 
  Search, 
  MessageSquare, 
  ArrowUpDown, 
  Hash, 
  User, 
  CheckCircle2,
  Clock
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { formatClaimWord, formatCurrency } from "@/lib/format";
import Link from "next/link";
import { ItemWorkflowDetail } from "@/types";

interface BatchItemsListProps {
  items: ItemWorkflowDetail[];
  collectionId: string;
}

type SortOption = "number" | "winner" | "status" | "comments";

function getItemStatusVariant(status: string): "emerald" | "amber" | "blue" | "slate" {
  switch (status) {
    case "claimed": return "emerald";
    case "needs_review": return "amber";
    case "manual_override": return "blue";
    case "locked": return "slate";
    default: return "slate";
  }
}

export function BatchItemsList({ items, collectionId }: BatchItemsListProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("number");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Search
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(item => 
        item.itemNumber.toString().includes(lowerSearch) ||
        item.winner?.buyerName?.toLowerCase().includes(lowerSearch) ||
        item.status.toLowerCase().includes(lowerSearch)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "number":
          comparison = a.itemNumber - b.itemNumber;
          break;
        case "winner":
          comparison = (a.winner?.buyerName || "").localeCompare(b.winner?.buyerName || "");
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "comments":
          comparison = a.commentCount - b.commentCount;
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [items, search, sortBy, sortOrder]);

  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(option);
      setSortOrder("asc");
    }
  };

  const summary = useMemo(() => {
    const total = items.length;
    const claimed = items.filter(i => i.status === 'claimed' || i.status === 'locked' || i.status === 'manual_override').length;
    const review = items.filter(i => i.status === 'needs_review').length;
    const unclaimed = total - claimed - review;
    return { total, claimed, unclaimed, review };
  }, [items]);

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Hash className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Items</p>
            <p className="text-sm font-bold text-slate-900">{summary.total}</p>
          </div>
        </div>
        <div className="h-8 w-px bg-slate-100" />
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Claimed</p>
            <p className="text-sm font-bold text-emerald-600">{summary.claimed}</p>
          </div>
        </div>
        <div className="h-8 w-px bg-slate-100" />
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unclaimed</p>
            <p className="text-sm font-bold text-slate-600">{summary.unclaimed}</p>
          </div>
        </div>
        <div className="h-8 w-px bg-slate-100" />
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <ArrowUpDown className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Needs Review</p>
            <p className="text-sm font-bold text-amber-600">{summary.review}</p>
          </div>
        </div>
      </div>

      {/* Search & Sort Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search items or winners..."
            className="w-full h-11 rounded-xl border-0 bg-white ring-1 ring-slate-200 py-2 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-black uppercase tracking-widest text-slate-400 mr-2">Sort:</span>
          <Button 
            variant={sortBy === "number" ? "primary" : "outline"} 
            size="sm" 
            className="rounded-xl h-9 font-bold"
            onClick={() => toggleSort("number")}
          >
            <Hash className="mr-1.5 h-3.5 w-3.5" />
            #
          </Button>
          <Button 
            variant={sortBy === "winner" ? "primary" : "outline"} 
            size="sm" 
            className="rounded-xl h-9 font-bold whitespace-nowrap"
            onClick={() => toggleSort("winner")}
          >
            <User className="mr-1.5 h-3.5 w-3.5" />
            Winner
          </Button>
          <Button 
            variant={sortBy === "status" ? "primary" : "outline"} 
            size="sm" 
            className="rounded-xl h-9 font-bold"
            onClick={() => toggleSort("status")}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Status
          </Button>
          <Button 
            variant={sortBy === "comments" ? "primary" : "outline"} 
            size="sm" 
            className="rounded-xl h-9 font-bold"
            onClick={() => toggleSort("comments")}
          >
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            Most Comments
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredAndSortedItems.map((item) => (
          <Card
            key={item.id}
            className="overflow-hidden border-0 bg-white shadow-sm ring-1 ring-slate-100 transition-all duration-300 hover:shadow-md hover:ring-indigo-200"
          >
            <div className="relative aspect-square">
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
              <div className="absolute left-3 top-3 flex flex-col space-y-2">
                <span className="rounded-lg bg-slate-900/90 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white ring-1 ring-white/10">
                  #{String(item.itemNumber).padStart(2, "0")}
                </span>
                <StatusBadge
                  label={item.status.replace("_", " ")}
                  variant={getItemStatusVariant(item.status)}
                  className="rounded-lg px-2 py-1"
                />
              </div>
            </div>

            <CardContent className="space-y-4 p-4">
              <div className="min-h-12">
                {item.winner ? (
                  <div>
                    <p className="text-sm font-bold text-slate-900 line-clamp-1">{item.winner.buyerName}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {formatClaimWord(item.winningClaimWord)} | {formatCurrency(item.resolvedPrice)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-slate-400 italic">Unclaimed</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                      No winner yet
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                <div className="flex items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                  {item.commentCount} comments
                </div>
                <Link href={`/collections/${collectionId}/items/${item.id}`}>
                  <Button variant="outline" size="sm" className="rounded-xl font-bold">
                    Open
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredAndSortedItems.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300 mb-4">
              <Search className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No items found</h3>
            <p className="text-sm text-slate-500">Try adjusting your search or sort criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
