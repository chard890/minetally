import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Link from 'next/link';
import { CreateCollectionForm } from '@/components/workflow/CreateCollectionForm';
import { FacebookPageRepository } from '@/repositories/facebook-page.repository';

export default async function NewCollectionPage() {
  const pages = await FacebookPageRepository.listPages();

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-12">
      <div className="flex items-center space-x-5">
        <Link href="/collections">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-2xl border-slate-200 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create Collection</h1>
          <p className="text-sm font-medium text-slate-500">
            Define a new weekly drop or selling event.
          </p>
        </div>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-slate-100 overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
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

