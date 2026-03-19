import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { SupabaseConfigGuide } from '@/components/workflow/SupabaseConfigGuide';
import { isSupabaseConfigured } from '@/lib/supabase';
import Link from 'next/link';
import { CreateCollectionForm } from '@/components/workflow/CreateCollectionForm';
import { FacebookPageRepository } from '@/repositories/facebook-page.repository';

export default async function NewCollectionPage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseConfigGuide />;
  }

  const pages = await FacebookPageRepository.listPages();

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-12">
      <div className="flex items-center space-x-5">
        <Link href="/collections">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12"
          >
            <ArrowLeft className="h-5 w-5 text-[#6b6b6b]" />
          </Button>
        </Link>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#8b8594]">Setup</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#2b2b2b]">Create Collection</h1>
          <p className="text-sm font-medium text-[#6b6b6b]">
            Define a new weekly drop or selling event.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border-0">
        <CardHeader className="border-b border-white/45 bg-transparent">
          <CardTitle className="text-lg font-bold">Collection Details</CardTitle>
          <CardDescription>
            These details will be used to organize batches and track buyer totals.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <CreateCollectionForm pages={pages} />
        </CardContent>
      </Card>
    </div>
  );
}
