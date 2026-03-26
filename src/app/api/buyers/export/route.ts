import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';
import { collectionService } from '@/services/collection.service';

function escapeHtml(value: string | number | null | undefined) {
  const stringValue = value == null ? '' : String(value);
  return stringValue
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function formatExcelDate(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatAmount(value: number | null | undefined) {
  if (typeof value !== 'number') {
    return '';
  }

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
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
  const totalAmount = buyers.reduce((sum, buyer) => sum + buyer.totalAmount, 0);
  const totalItems = buyers.reduce((sum, buyer) => sum + buyer.totalWonItems, 0);

  const rows = buyers.flatMap((buyer) =>
    buyer.items.map((item, index) => ({
      buyerName: buyer.buyerName,
      buyerId: buyer.buyerId,
      buyerTotalItems: buyer.totalWonItems,
      buyerTotalAmount: buyer.totalAmount,
      itemNumber: item.itemNumber,
      batchTitle: item.batchTitle,
      claimWord: item.claimWord,
      resolvedPrice: item.resolvedPrice,
      claimedAt: item.claimedAt,
      itemId: item.itemId,
      isFirstRowForBuyer: index === 0,
    })),
  );

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      font-family: Calibri, Arial, sans-serif;
      color: #1f2937;
      margin: 24px;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 18px;
    }
    .meta {
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    .meta td {
      border: 1px solid #e5e7eb;
      padding: 8px 10px;
      font-size: 12px;
    }
    .meta .label {
      background: #f3f4f6;
      font-weight: 700;
      color: #374151;
      width: 140px;
    }
    table.sheet {
      border-collapse: collapse;
      width: 100%;
    }
    .sheet th, .sheet td {
      border: 1px solid #e5e7eb;
      padding: 8px 10px;
      font-size: 12px;
      vertical-align: top;
    }
    .sheet th {
      background: #efe7ff;
      color: #312e81;
      font-weight: 700;
      text-align: left;
    }
    .sheet tr.group-start td {
      border-top: 2px solid #c4b5fd;
    }
    .buyer-cell {
      background: #faf5ff;
      font-weight: 700;
    }
    .money {
      text-align: right;
      white-space: nowrap;
    }
    .muted {
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="title">${escapeHtml(selectedCollection.name)} Buyer Totals</div>
  <div class="subtitle">Excel export generated from MineTally</div>

  <table class="meta">
    <tr>
      <td class="label">Collection</td>
      <td>${escapeHtml(selectedCollection.name)}</td>
      <td class="label">Status</td>
      <td>${escapeHtml(selectedCollection.status)}</td>
    </tr>
    <tr>
      <td class="label">Total Buyers</td>
      <td>${buyers.length}</td>
      <td class="label">Total Won Items</td>
      <td>${totalItems}</td>
    </tr>
    <tr>
      <td class="label">Total Amount</td>
      <td>${escapeHtml(formatAmount(totalAmount))}</td>
      <td class="label">Date Range</td>
      <td>${escapeHtml(selectedCollection.startDate)} to ${escapeHtml(selectedCollection.endDate)}</td>
    </tr>
  </table>

  <table class="sheet">
    <thead>
      <tr>
        <th>Buyer</th>
        <th>Buyer ID</th>
        <th>Total Items</th>
        <th>Total Amount</th>
        <th>Item #</th>
        <th>Batch</th>
        <th>Claim</th>
        <th>Price</th>
        <th>Claimed At</th>
        <th>Item ID</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
      <tr class="${row.isFirstRowForBuyer ? 'group-start' : ''}">
        <td class="${row.isFirstRowForBuyer ? 'buyer-cell' : ''}">${row.isFirstRowForBuyer ? escapeHtml(row.buyerName) : ''}</td>
        <td class="${row.isFirstRowForBuyer ? 'buyer-cell muted' : 'muted'}">${row.isFirstRowForBuyer ? escapeHtml(row.buyerId) : ''}</td>
        <td class="${row.isFirstRowForBuyer ? 'buyer-cell' : ''}">${row.isFirstRowForBuyer ? row.buyerTotalItems : ''}</td>
        <td class="money ${row.isFirstRowForBuyer ? 'buyer-cell' : ''}">${row.isFirstRowForBuyer ? escapeHtml(formatAmount(row.buyerTotalAmount)) : ''}</td>
        <td>${row.itemNumber}</td>
        <td>${escapeHtml(row.batchTitle)}</td>
        <td>${escapeHtml(row.claimWord)}</td>
        <td class="money">${escapeHtml(formatAmount(row.resolvedPrice))}</td>
        <td>${escapeHtml(formatExcelDate(row.claimedAt))}</td>
        <td class="muted">${escapeHtml(row.itemId)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</body>
</html>`;

  const filename = `${sanitizeFilenamePart(selectedCollection.name)}-buyer-totals.xls`;

  return new NextResponse(`\uFEFF${html}`, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
