import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  RefreshCw,
  ShoppingBag,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { MetricCard } from "@/components/workflow/MetricCard";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { SupabaseConfigGuide } from "@/components/workflow/SupabaseConfigGuide";
import { formatCurrency } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase";
import { collectionService } from "@/services/collection.service";
import { FinalizeActions } from "@/components/workflow/FinalizeActions";

export default async function FinalizeCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <SupabaseConfigGuide />;
  }

  const { id } = await params;
  const collection = await collectionService.getCollection(id);
  const summary = await collectionService.getFinalizeSnapshot(id);

  if (!collection || !summary) {
    notFound();
  }

  return (
    <div className="space-y-8">
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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Finalize Collection</h1>
          <p className="text-sm font-medium text-slate-500">
            {collection.name} | Final recount and collection lock
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div className="grid gap-6 sm:grid-cols-3">
            <MetricCard
              label="Total Buyers"
              value={summary.totalBuyers}
              icon={Users}
              colorClass="text-indigo-600"
              backgroundClass="bg-indigo-50"
            />
            <MetricCard
              label="Claimed Items"
              value={summary.totalClaimedItems}
              icon={CheckCircle2}
              colorClass="text-emerald-600"
              backgroundClass="bg-emerald-50"
            />
            <MetricCard
              label="Collection Value"
              value={formatCurrency(summary.totalCollectionValue)}
              icon={ShoppingBag}
              colorClass="text-slate-700"
              backgroundClass="bg-slate-100"
            />
          </div>

          <Card className="border-0 shadow-sm ring-1 ring-slate-100">
            <CardHeader className="border-b border-slate-50">
              <CardTitle className="text-lg font-bold">Pre-finalization Check</CardTitle>
              <CardDescription>
                Review warning cards before locking the collection totals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-bold text-emerald-900">
                    {summary.totalClaimedItems} item photos already have winners
                  </span>
                </div>
                <StatusBadge label="Ready" variant="emerald" />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Manual overrides recorded: {summary.manualOverridesCount}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    These items were adjusted manually and should match the seller&apos;s screenshot proof.
                  </p>
                </div>
                <StatusBadge label="Check" variant="blue" />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    Needs review items: {summary.needsReviewItems}
                  </p>
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    Cancelled claims or missing price matches should be resolved before finalize.
                  </p>
                </div>
                <StatusBadge label="Warning" variant="amber" />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Cancel items tracked: {summary.cancelItems}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    The system keeps these visible so the seller can double check reclaims and reposts.
                  </p>
                </div>
                <StatusBadge label="Tracked" variant="slate" />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {summary.warnings.map((warning) => (
              <Card key={warning.id} className="border-0 shadow-sm ring-1 ring-slate-100">
                <CardContent className="flex items-start space-x-4 pt-6">
                  <div
                    className={`rounded-2xl p-3 ${
                      warning.severity === "warning"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{warning.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{warning.detail}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-8 overflow-hidden rounded-3xl border-0 shadow-xl ring-1 ring-slate-200">
            <CardHeader className="bg-slate-900 p-8 text-white">
              <CardTitle className="text-xl font-black">Safety Lock</CardTitle>
              <CardDescription className="text-slate-400">
                Final check before closing the collection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 bg-white p-8">
              <div className="flex items-center space-x-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Status
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {summary.readyToFinalize ? "Ready to finalize" : "Needs review first"}
                  </p>
                </div>
              </div>

              <FinalizeActions 
                collectionId={id} 
                readyToFinalize={summary.readyToFinalize} 
                isLocked={collection.status === 'locked' || collection.status === 'finalized'} 
              />

              <p className="px-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Once locked, winners, prices, and buyer totals are treated as final.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
