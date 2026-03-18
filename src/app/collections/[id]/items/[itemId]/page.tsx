import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { formatClaimWord, formatCurrency, formatTimeOnly } from "@/lib/format";
import { collectionService } from "@/services/collection.service";
import { priceService } from "@/services/price.service";
import { ItemActionButtons, PriceOverrideAction } from "@/components/workflow/ItemActionButtons";
import { ResolutionTransparency } from "@/components/workflow/ResolutionTransparency";
import { CommenterNameOverride } from "@/components/workflow/CommenterNameOverride";
import { AuditLogRepository } from "@/repositories/audit-log.repository";

type AuditLogEntry = {
  item_id?: string;
  action: string;
  created_at: string;
  reason?: string | null;
  details_json?: Record<string, unknown> | null;
};

function getCommentVariant(tag: string) {
  switch (tag) {
    case "first claimant":
      return "emerald";
    case "valid claim":
      return "blue";
    case "late claim":
      return "slate";
    case "cancel comment":
      return "amber";
    default:
      return "slate";
  }
}

function getPriceReviewVariant(status: string) {
  switch (status) {
    case "ready":
      return "emerald";
    case "manual_override":
      return "blue";
    case "locked":
      return "slate";
    default:
      return "amber";
  }
}

export default async function ItemReviewPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const item = await collectionService.getItem(id, itemId);

  if (!item) {
    notFound();
  }

   const auditLogs = await AuditLogRepository.listByCollection(id);
   const itemLogs = (auditLogs as AuditLogEntry[]).filter((log) => log.item_id === itemId);

  const priceEntries = priceService.getOrderedEntries(item.priceMap);

  return (
    <div className="space-y-8">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="flex items-center space-x-5">
          <Link href={`/collections/${id}`}>
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-2xl border-slate-200 shadow-sm hover:bg-slate-50"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Button>
          </Link>
          <div>
            <div className="mb-1 flex items-center space-x-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Item #{String(item.itemNumber).padStart(2, "0")}
              </h1>
              <StatusBadge
                label={item.status.replace("_", " ")}
                variant={
                  item.status === "claimed"
                    ? "emerald"
                    : item.status === "needs_review"
                      ? "amber"
                      : item.status === "manual_override"
                        ? "blue"
                        : "slate"
                }
              />
            </div>
            <p className="text-sm font-medium text-slate-500">
              Source batch post: <span className="font-bold text-slate-700">{item.sourceBatchTitle}</span>
            </p>
          </div>
        </div>
        <ItemActionButtons collectionId={id} batchId={item.sourceBatchPostId} item={item} />
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card className="sticky top-8 overflow-hidden rounded-3xl border-0 shadow-xl ring-1 ring-slate-100">
            <div className="relative">
              <img src={item.imageUrl} alt={item.title} className="h-auto w-full object-cover" />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/40 to-transparent p-6">
                <a href={item.sourcePostUrl} className="inline-flex">
                  <Button
                    variant="outline"
                    className="border-0 bg-white/90 text-xs font-bold text-slate-900 backdrop-blur-md"
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    View Original Facebook Photo
                  </Button>
                </a>
              </div>
            </div>

            <CardContent className="space-y-6 bg-white p-6">
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 overflow-hidden rounded-2xl ring-1 ring-slate-200">
                  <img src={item.thumbnailUrl} alt={`${item.title} thumbnail`} className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Thumbnail Preview
                  </p>
                  <p className="text-sm font-bold text-slate-900">{item.title}</p>
                  <p className="text-xs font-medium text-slate-500">Photo ID {item.photoId}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Winner
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {item.winner?.buyerName ?? "Unclaimed"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Winning Claim Word
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {formatClaimWord(item.winningClaimWord)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Resolved Price
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {formatCurrency(item.resolvedPrice)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Size Label
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {item.sizeLabel ?? "None"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Price Review Status
                  </p>
                  <StatusBadge
                    label={item.priceReviewStatus.replace("_", " ")}
                    variant={getPriceReviewVariant(item.priceReviewStatus) as "emerald" | "amber" | "blue" | "slate"}
                  />
                </div>
                <p className="text-sm font-medium text-slate-600">{item.claimStatus}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-slate-100 overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-3">
              <CardTitle className="text-sm font-bold flex items-center">
                <ShieldCheck className="h-4 w-4 mr-2 text-indigo-600" />
                System Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-slate-100">
                 {itemLogs.length > 0 ? itemLogs.map((log, idx) => (
                   <div key={idx} className="p-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{log.action.replace('_', ' ')}</span>
                        <span className="text-[10px] text-slate-400">{formatTimeOnly(log.created_at)}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-900">{log.reason || 'No summary'}</p>
                      {log.details_json && Object.keys(log.details_json).length > 0 && (
                        <p className="text-[9px] text-slate-400 truncate">
                          Details: {JSON.stringify(log.details_json)}
                        </p>
                      )}
                   </div>
                 )) : (
                   <div className="p-8 text-center">
                     <p className="text-xs text-slate-400 italic">No audit events recorded for this item yet.</p>
                   </div>
                 )}
               </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-3">
          <Card className="border-0 shadow-sm ring-1 ring-slate-100">
            <CardHeader className="border-b border-slate-50">
              <CardTitle className="text-lg font-bold">Auto-Resolution Transparency</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-6 md:grid-cols-2">
                <ResolutionTransparency 
                  type="winner"
                  sourceText={`${item.commentCount} Comments`}
                  ruleUsed="First Valid Claim"
                  resultValue={item.winner?.buyerName || null}
                  status={item.status === 'manual_override' ? 'manual' : (item.winner ? 'auto' : 'needs_review')}
                />
                <ResolutionTransparency 
                  type="price"
                  sourceText={item.rawPriceText || "Batch Caption"}
                  ruleUsed="Claim Keyword Map"
                  resultValue={item.resolvedPrice ? formatCurrency(item.resolvedPrice) : null}
                  status={item.priceReviewStatus === 'manual_override' ? 'manual' : (item.resolvedPrice ? 'auto' : 'needs_review')}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Raw Price Text (Source)
                  </p>
                  <div className="whitespace-pre-line rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-700">
                    {item.rawPriceText || "No description text found on post."}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Parsed Price Map
                  </p>
                  <div className="space-y-3">
                    {priceEntries.map(([claimWord, amount]) => (
                      <div
                        key={claimWord}
                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-900">{formatClaimWord(claimWord)}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Claim word pricing
                          </p>
                        </div>
                        <p className="text-sm font-black text-slate-900">{formatCurrency(amount)}</p>
                      </div>
                    ))}
                    {item.needsPriceReview ? (
                      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                        <p className="text-sm font-bold text-amber-900">
                          Missing price for {formatClaimWord(item.winningClaimWord)}
                        </p>
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          This winning claim word does not exist in the parsed map, so the item is flagged for price review.
                        </p>
                      </div>
                    ) : null}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Manual Price Override
                      </p>
                      <PriceOverrideAction collectionId={id} batchId={item.sourceBatchPostId} item={item} />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex h-[760px] flex-col overflow-hidden border-0 shadow-sm ring-1 ring-slate-100">
            <CardHeader className="border-b border-slate-50 bg-white p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-lg font-bold">
                  <MessageSquare className="mr-3 h-5 w-5 text-indigo-600" />
                  Comment Timeline
                </CardTitle>
                <StatusBadge label={`${item.commentCount} comments`} variant="slate" />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto bg-slate-50/20 p-0">
              <div className="divide-y divide-slate-100">
                {item.comments.map((comment) => (
                  <div key={comment.id} className="space-y-3 p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <CommenterNameOverride
                          collectionId={id}
                          itemId={itemId}
                          commentId={comment.id}
                          currentName={comment.buyerName}
                        />
                        <div className="mt-1 flex flex-wrap gap-2">
                          {comment.tags.map((tag) => (
                            <StatusBadge
                              key={tag}
                              label={tag}
                              variant={getCommentVariant(tag) as "emerald" | "blue" | "slate" | "amber"}
                              className="px-2 py-0.5"
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {formatTimeOnly(comment.timestamp)}
                      </p>
                    </div>
                    <p className="rounded-xl border border-slate-100 bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-sm">
                      {comment.message}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
