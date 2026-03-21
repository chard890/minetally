import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { SupabaseConfigGuide } from '@/components/workflow/SupabaseConfigGuide';
import { isSupabaseConfigured } from '@/lib/supabase';
import Link from 'next/link';
import { CreateCollectionForm } from '@/components/workflow/CreateCollectionForm';
import { FacebookPageRepository } from '@/repositories/facebook-page.repository';
import { getActiveFacebookPageDbId, getKnownFacebookPageDbIds } from '@/lib/active-facebook-page';

export default async function NewCollectionPage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseConfigGuide />;
  }

  const activePageId = await getActiveFacebookPageDbId();
  const knownPageIds = await getKnownFacebookPageDbIds();
  const pages = await FacebookPageRepository.listPagesByIds(knownPageIds);

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-12 sm:space-y-8">
      <div className="flex items-start gap-3 sm:items-center sm:space-x-5">
        <Link href="/collections">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 sm:h-12 sm:w-12"
          >
            <ArrowLeft className="h-4.5 w-4.5 text-[#6b6b6b] sm:h-5 sm:w-5" />
          </Button>
        </Link>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#8b8594]">Setup</p>
          <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-[#2b2b2b] sm:mt-2 sm:text-4xl">Create Collection</h1>
          <p className="text-[13px] font-medium text-[#6b6b6b] sm:text-sm">
            Define a new weekly drop or selling event.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border-0">
        <CardHeader className="border-b border-white/45 bg-transparent">
          <CardTitle className="text-base font-bold sm:text-lg">Collection Details</CardTitle>
          <CardDescription>
            These details will be used to organize batches and track buyer totals.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-8">
          <CreateCollectionForm pages={pages} activePageId={knownPageIds.includes(activePageId ?? '') ? activePageId : null} />
        </CardContent>
      </Card>
    </div>
  );
}
