import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';
import { collectionService } from '@/services/collection.service';

function escapeCsvValue(value: string | number | null | undefined) {
  const stringValue = value == null ? '' : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function sanitizeFilenamePart(value: string) {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'buyer-totals'
  );
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 400 });
  }

  const url = new URL(request.url);
  const requestedCollectionId = url.searchParams.get('collectionId')?.trim() ?? '';
  const collections = await collectionService.getCollections();
  const selectedCollection =
    collections.find((collection) => collection.id === requestedCollectionId)
    ?? collections.find((collection) => collection.status === 'open')
    ?? collections[0];

  if (!selectedCollection) {
    return NextResponse.json({ error: 'No collection is available to export.' }, { status: 404 });
  }

  const buyers = await collectionService.getBuyerTotals(selectedCollection.id);
  const header = [
    'Collection',
    'Collection Status',
    'Buyer ID',
    'Buyer Name',
    'Total Won Items',
    'Buyer Total Amount',
    'Item Number',
    'Batch Title',
    'Claim Word',
    'Resolved Price',
    'Claimed At',
    'Item ID',
  ];

  const rows = buyers.flatMap((buyer) => {
    if (buyer.items.length === 0) {
      return [[
        buyer.collectionName,
        buyer.collectionStatus,
        buyer.buyerId,
        buyer.buyerName,
        buyer.totalWonItems,
        buyer.totalAmount,
        '',
        '',
        '',
        '',
        '',
        '',
      ]];
    }

    return buyer.items.map((item) => [
      buyer.collectionName,
      buyer.collectionStatus,
      buyer.buyerId,
      buyer.buyerName,
      buyer.totalWonItems,
      buyer.totalAmount,
      item.itemNumber,
      item.batchTitle,
      item.claimWord,
      item.resolvedPrice,
      item.claimedAt,
      item.itemId,
    ]);
  });

  const csvLines = [
    header.map((value) => escapeCsvValue(value)).join(','),
    ...rows.map((row) => row.map((value) => escapeCsvValue(value)).join(',')),
  ];
  const csvContent = `\uFEFF${csvLines.join('\r\n')}`;
  const filename = `${sanitizeFilenamePart(selectedCollection.name)}-buyer-totals.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
