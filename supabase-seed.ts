import { getSeeds } from './src/lib/store';
import { CollectionRepository } from './src/repositories/collection.repository';
import { BatchRepository } from './src/repositories/batch.repository';
import { ItemRepository } from './src/repositories/item.repository';
import { CommentRepository } from './src/repositories/comment.repository';
import { WinnerRepository } from './src/repositories/winner.repository';
import { SettingsRepository } from './src/repositories/settings.repository';
import { getServiceSupabase } from './src/lib/supabase';

/**
 * SEEDING SCRIPT
 * This script migrates the current mock seeds into the Supabase database.
 */
async function seed() {
  console.log('🚀 Starting Supabase Seeding...');
  
  const seeds = getSeeds();
  const supabase = getServiceSupabase();

  // 1. Initial Settings
  console.log('📦 Seeding Settings...');
  await SettingsRepository.updateSettings({
    facebookIntegration: {
      connectedPageName: "Ukay Queen Closet",
      connectedSince: new Date().toISOString(),
      syncIntervalLabel: "Every 10 minutes",
      autoSyncComments: true,
      importOnlyCollectionDateRange: true,
    },
    validClaimKeywords: ["mine", "grab", "steal"],
    cancelKeywords: ["cancel", "pass", "mine off"],
    claimCodeMapping: { M: "mine", S: "steal", G: "grab" },
    syncPreferences: {
      syncPhotosFirst: true,
      syncCommentsAfterImport: true,
      requireThumbnailVerification: true,
    },
    finalizationBehavior: {
      autoReassignOnCancel: false,
      lockCollectionOnFinalize: true,
      requireReviewBeforeFinalize: true,
    }
  });

  // 2. Facebook Page (Dummy)
  console.log('📦 Seeding Facebook Page...');
  const { data: page } = await supabase
    .from('facebook_pages')
    .upsert({
        meta_page_id: 'page-123',
        page_name: 'Ukay Queen Closet',
        connected_at: new Date().toISOString()
    })
    .select('id')
    .single();

  const pageId = page?.id;

  for (const colSeed of seeds) {
    console.log(`📂 Seeding Collection: ${colSeed.name}...`);
    
    // 3. Collection
    const { data: col } = await supabase
      .from('collections')
      .insert({
          name: colSeed.name,
          start_date: colSeed.startDate,
          end_date: colSeed.endDate,
          status: colSeed.status,
          page_id: pageId,
          finalize_date: colSeed.finalizeDate
      })
      .select('id')
      .single();

    const colId = col?.id;
    if (!colId) continue;

    for (const batchSeed of colSeed.batches) {
      console.log(`  📄 Seeding Batch: ${batchSeed.title}...`);
      
      // 4. Batch Post
      const { data: batch } = await supabase
        .from('batch_posts')
        .insert({
            collection_id: colId,
            meta_post_id: batchSeed.id,
            title: batchSeed.title,
            sync_status: 'synced',
            posted_at: batchSeed.postedAt
        })
        .select('id')
        .single();

      const batchId = batch?.id;
      if (!batchId) continue;

      for (const itemSeed of batchSeed.items) {
        // 5. Items
        const { data: item } = await supabase
          .from('items')
          .insert({
              batch_post_id: batchId,
              item_number: itemSeed.itemNumber,
              image_url: itemSeed.imageUrl,
              thumbnail_url: itemSeed.thumbnailUrl,
              meta_media_id: itemSeed.photoId,
              size_label: itemSeed.sizeLabel,
              raw_price_text: itemSeed.rawPriceText,
              status: itemSeed.lockItem ? 'locked' : (itemSeed.manualResolution ? 'manual_override' : 'claimed'),
              is_locked: itemSeed.lockItem || false
          })
          .select('id')
          .single();

        const itemId = item?.id;
        if (!itemId) continue;

        // 6. Comments
        if (itemSeed.comments.length > 0) {
            await CommentRepository.insertMany(itemSeed.comments.map(c => ({
                ...c,
                itemId
            })));
        }

        // 7. Winners (if any)
        if (itemSeed.manualResolution) {
            await WinnerRepository.saveWinner({
                itemId,
                batchPostId: batchId,
                buyerId: itemSeed.manualResolution.buyerId,
                commenterId: itemSeed.manualResolution.buyerId,
                buyerName: itemSeed.manualResolution.buyerName,
                claimWord: itemSeed.manualResolution.claimWord,
                resolvedPrice: itemSeed.manualResolution.resolvedPrice,
                status: 'manual',
                isManualOverride: true
            });
        }
      }
    }
  }

  console.log('✅ Seeding Complete!');
}

seed().catch(console.error);
