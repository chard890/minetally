import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';
import { collectionService } from '@/services/collection.service';

function escapeXml(value: string | number | null | undefined) {
  const stringValue = value == null ? '' : String(value);
  return stringValue
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

function cell(value: string | number | null | undefined, styleId?: string) {
  const style = styleId ? ` ss:StyleID="${styleId}"` : '';
  return `<Cell${style}><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

function row(cells: string[]) {
  return `<Row>${cells.join('')}</Row>`;
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

  const rows: string[] = [];
  rows.push(row([cell(`${selectedCollection.name} Buyer Totals`, 'Title')]));
  rows.push(row([cell('Excel export generated from MineTally', 'Subtle')]));
  rows.push(row([]));
  rows.push(row([cell('Collection', 'Label'), cell(selectedCollection.name)]));
  rows.push(row([cell('Status', 'Label'), cell(selectedCollection.status)]));
  rows.push(row([cell('Total Buyers', 'Label'), cell(buyers.length)]));
  rows.push(row([cell('Total Won Items', 'Label'), cell(totalItems)]));
  rows.push(row([cell('Total Amount', 'Label'), cell(formatAmount(totalAmount))]));
  rows.push(row([cell('Date Range', 'Label'), cell(`${selectedCollection.startDate} to ${selectedCollection.endDate}`)]));
  rows.push(row([]));
  rows.push(
    row([
      cell('Buyer', 'Header'),
      cell('Buyer ID', 'Header'),
      cell('Total Items', 'Header'),
      cell('Total Amount', 'Header'),
      cell('Item #', 'Header'),
      cell('Batch', 'Header'),
      cell('Claim', 'Header'),
      cell('Price', 'Header'),
      cell('Claimed At', 'Header'),
      cell('Item ID', 'Header'),
    ]),
  );

  for (const buyer of buyers) {
    buyer.items.forEach((item, index) => {
      const isFirst = index === 0;
      rows.push(
        row([
          cell(isFirst ? buyer.buyerName : '', isFirst ? 'Buyer' : undefined),
          cell(isFirst ? buyer.buyerId : '', isFirst ? 'BuyerMuted' : 'Muted'),
          cell(isFirst ? buyer.totalWonItems : '', isFirst ? 'Buyer' : undefined),
          cell(isFirst ? formatAmount(buyer.totalAmount) : '', isFirst ? 'BuyerRight' : 'Right'),
          cell(item.itemNumber),
          cell(item.batchTitle),
          cell(item.claimWord),
          cell(formatAmount(item.resolvedPrice), 'Right'),
          cell(formatExcelDate(item.claimedAt)),
          cell(item.itemId, 'Muted'),
        ]),
      );
    });
  }

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1F2937"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#111827"/>
  </Style>
  <Style ss:ID="Subtle">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#6B7280"/>
  </Style>
  <Style ss:ID="Label">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#374151"/>
   <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#312E81"/>
   <Interior ss:Color="#EFE7FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="Buyer">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#FAF5FF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="BuyerMuted">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#6B7280"/>
   <Interior ss:Color="#FAF5FF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="BuyerRight">
   <Alignment ss:Horizontal="Right"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#FAF5FF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Right">
   <Alignment ss:Horizontal="Right"/>
  </Style>
  <Style ss:ID="Muted">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#6B7280"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Buyer Totals">
  <Table>
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="60"/>
   <Column ss:Width="90"/>
   <Column ss:Width="70"/>
   <Column ss:Width="90"/>
   <Column ss:Width="140"/>
   <Column ss:Width="260"/>
   ${rows.join('')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>10</SplitHorizontal>
   <TopRowBottomPane>10</TopRowBottomPane>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

  const filename = `${sanitizeFilenamePart(selectedCollection.name)}-buyer-totals.xml`;

  return new NextResponse(`\uFEFF${xml}`, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
