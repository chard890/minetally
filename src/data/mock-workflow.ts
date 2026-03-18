import { BatchPostSeed, CollectionSeed, ImportedItemSeed, RawItemComment } from "@/types";

const BUYERS = [
  { id: "buyer-anna-belle", name: "Anna Belle" },
  { id: "buyer-maria-santos", name: "Maria Santos" },
  { id: "buyer-jen-ramos", name: "Jen Ramos" },
  { id: "buyer-lina-p", name: "Lina P." },
  { id: "buyer-kaye-lopez", name: "Kaye Lopez" },
  { id: "buyer-trixie-m", name: "Trixie M." },
  { id: "buyer-alba-minda", name: "Alba Minda" },
  { id: "buyer-joan-lee", name: "Joan Lee" },
  { id: "buyer-dianne-v", name: "Dianne V." },
  { id: "buyer-pat-garcia", name: "Pat Garcia" },
  { id: "buyer-nina-reyes", name: "Nina Reyes" },
  { id: "buyer-ara-cruz", name: "Ara Cruz" },
];

const IMAGES = [
  "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=900&q=80",
  "https://images.unsplash.com/photo-1542272604-787c3835535d?w=900&q=80",
  "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=900&q=80",
  "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=900&q=80",
  "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=900&q=80",
  "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900&q=80",
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80",
  "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=900&q=80",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80",
  "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=900&q=80",
  "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=900&q=80",
  "https://images.unsplash.com/photo-1495385794356-15371f348c31?w=900&q=80",
];

type ScenarioName =
  | "mine-win"
  | "grab-win"
  | "steal-win"
  | "cancel-review"
  | "missing-price"
  | "manual-winner"
  | "manual-unclaimed"
  | "no-claim"
  | "locked-winner";

interface ScenarioInput {
  batchId: string;
  batchTitle: string;
  itemNumber: number;
  imageUrl: string;
  title: string;
  baseTimestamp: string;
  rawPriceText: string;
  sizeLabel?: string;
  buyerIndexes: number[];
  scenario: ScenarioName;
}

function buildComment(
  id: string,
  buyerIndex: number,
  timestamp: string,
  message: string,
): RawItemComment {
  return {
    id,
    buyerId: BUYERS[buyerIndex].id,
    buyerName: BUYERS[buyerIndex].name,
    timestamp,
    message,
  };
}

function withOffset(timestamp: string, offsetMinutes: number, offsetSeconds = 0): string {
  const date = new Date(timestamp);
  date.setMinutes(date.getMinutes() + offsetMinutes);
  date.setSeconds(date.getSeconds() + offsetSeconds);
  return date.toISOString();
}

function createScenarioItem(input: ScenarioInput): ImportedItemSeed {
  const sourcePostUrl = `https://facebook.com/${input.batchId}/${input.itemNumber}`;
  const thumbnailUrl = `${input.imageUrl}&fit=crop&h=300`;
  const itemId = `${input.batchId}-item-${String(input.itemNumber).padStart(2, "0")}`;
  const photoId = `photo-${input.batchId}-${input.itemNumber}`;
  const comments: RawItemComment[] = [];
  let manualResolution: ImportedItemSeed["manualResolution"];
  let lockItem = false;

  switch (input.scenario) {
    case "mine-win":
      comments.push(
        buildComment(`${itemId}-c1`, input.buyerIndexes[0], input.baseTimestamp, "mine"),
        buildComment(
          `${itemId}-c2`,
          input.buyerIndexes[1],
          withOffset(input.baseTimestamp, 0, 18),
          "grab po",
        ),
        buildComment(
          `${itemId}-c3`,
          input.buyerIndexes[2],
          withOffset(input.baseTimestamp, 1, 10),
          "mine sis",
        ),
      );
      break;
    case "grab-win":
      comments.push(
        buildComment(`${itemId}-c1`, input.buyerIndexes[0], input.baseTimestamp, "grab"),
        buildComment(
          `${itemId}-c2`,
          input.buyerIndexes[1],
          withOffset(input.baseTimestamp, 0, 14),
          "mine",
        ),
        buildComment(
          `${itemId}-c3`,
          input.buyerIndexes[2],
          withOffset(input.baseTimestamp, 1, 5),
          "hm po?",
        ),
      );
      break;
    case "steal-win":
      comments.push(
        buildComment(`${itemId}-c1`, input.buyerIndexes[0], input.baseTimestamp, "steal"),
        buildComment(
          `${itemId}-c2`,
          input.buyerIndexes[1],
          withOffset(input.baseTimestamp, 0, 11),
          "mine",
        ),
        buildComment(
          `${itemId}-c3`,
          input.buyerIndexes[2],
          withOffset(input.baseTimestamp, 0, 34),
          "mine off",
        ),
      );
      break;
    case "cancel-review":
      comments.push(
        buildComment(`${itemId}-c1`, input.buyerIndexes[0], input.baseTimestamp, "mine"),
        buildComment(
          `${itemId}-c2`,
          input.buyerIndexes[0],
          withOffset(input.baseTimestamp, 2, 0),
          "cancel po",
        ),
        buildComment(
          `${itemId}-c3`,
          input.buyerIndexes[1],
          withOffset(input.baseTimestamp, 2, 18),
          "grab",
        ),
      );
      break;
    case "missing-price":
      comments.push(
        buildComment(`${itemId}-c1`, input.buyerIndexes[0], input.baseTimestamp, "steal"),
        buildComment(
          `${itemId}-c2`,
          input.buyerIndexes[1],
          withOffset(input.baseTimestamp, 0, 16),
          "mine",
        ),
      );
      break;
    case "manual-winner":
      comments.push(
        buildComment(`${itemId}-c1`, input.buyerIndexes[0], input.baseTimestamp, "mine"),
        buildComment(
          `${itemId}-c2`,
          input.buyerIndexes[1],
          withOffset(input.baseTimestamp, 0, 6),
          "grab",
        ),
        buildComment(
          `${itemId}-c3`,
          input.buyerIndexes[2],
          withOffset(input.baseTimestamp, 1, 0),
          "mine",
        ),
      );
      manualResolution = {
        type: "winner",
        buyerId: BUYERS[input.buyerIndexes[1]].id,
        buyerName: BUYERS[input.buyerIndexes[1]].name,
        claimWord: "grab",
        note: "Seller verified screenshot and set the grab comment as the real first claimant.",
      };
      break;
    case "manual-unclaimed":
      comments.push(
        buildComment(`${itemId}-c1`, input.buyerIndexes[0], input.baseTimestamp, "mine"),
        buildComment(
          `${itemId}-c2`,
          input.buyerIndexes[0],
          withOffset(input.baseTimestamp, 0, 50),
          "pass",
        ),
        buildComment(
          `${itemId}-c3`,
          input.buyerIndexes[1],
          withOffset(input.baseTimestamp, 4, 10),
          "grab",
        ),
      );
      manualResolution = {
        type: "unclaimed",
        note: "Seller removed the claim because the item was reposted in a follow-up photo set.",
      };
      break;
    case "no-claim":
      comments.push(
        buildComment(`${itemId}-c1`, input.buyerIndexes[0], input.baseTimestamp, "how much po"),
        buildComment(
          `${itemId}-c2`,
          input.buyerIndexes[1],
          withOffset(input.baseTimestamp, 0, 23),
          "available?",
        ),
      );
      break;
    case "locked-winner":
      comments.push(
        buildComment(`${itemId}-c1`, input.buyerIndexes[0], input.baseTimestamp, "grab"),
        buildComment(
          `${itemId}-c2`,
          input.buyerIndexes[1],
          withOffset(input.baseTimestamp, 0, 22),
          "steal",
        ),
      );
      lockItem = true;
      break;
  }

  return {
    id: itemId,
    itemNumber: input.itemNumber,
    title: input.title,
    imageUrl: input.imageUrl,
    thumbnailUrl,
    photoId,
    sizeLabel: input.sizeLabel,
    rawPriceText: input.rawPriceText,
    sourceBatchPostId: input.batchId,
    sourceBatchTitle: input.batchTitle,
    sourcePostUrl,
    comments,
    manualResolution,
    lockItem,
  };
}

function createActiveBatch(
  batchNumber: number,
  title: string,
  postedAt: string,
  scenarioRow: ScenarioName[],
  syncStatus: BatchPostSeed["syncStatus"],
  syncNote: string,
): BatchPostSeed {
  const batchId = `march-batch-${String(batchNumber).padStart(2, "0")}`;
  const rawPriceTexts = [
    "M 180\nS 220\nG 260",
    "M 220\nS 260\nG 300",
    "M 250\nS 290\nG 330",
    "M 280\nS 320\nG 360",
    "M 230\nG 310",
  ];
  const sizeLabels = ["Small", "Medium", "Large", "Free Size"];

  return {
    id: batchId,
    title: `Batch ${String(batchNumber).padStart(2, "0")} - ${title}`,
    postedAt,
    syncStatus,
    syncNote,
    items: scenarioRow.map((scenario, index) =>
      createScenarioItem({
        batchId,
        batchTitle: `Batch ${String(batchNumber).padStart(2, "0")} - ${title}`,
        itemNumber: index + 1,
        imageUrl: IMAGES[(batchNumber * 3 + index) % IMAGES.length],
        title: `${title} Item ${index + 1}`,
        baseTimestamp: withOffset(postedAt, index * 3 + 1, 10),
        rawPriceText:
          scenario === "missing-price" ? rawPriceTexts[4] : rawPriceTexts[index % 4],
        sizeLabel: sizeLabels[(batchNumber + index) % sizeLabels.length],
        buyerIndexes: [
          (batchNumber + index) % BUYERS.length,
          (batchNumber + index + 2) % BUYERS.length,
          (batchNumber + index + 4) % BUYERS.length,
        ],
        scenario,
      }),
    ),
  };
}

function createArchiveBatch(
  collectionPrefix: string,
  batchNumber: number,
  title: string,
  postedAt: string,
): BatchPostSeed {
  const batchId = `${collectionPrefix}-batch-${String(batchNumber).padStart(2, "0")}`;

  return {
    id: batchId,
    title: `Batch ${String(batchNumber).padStart(2, "0")} - ${title}`,
    postedAt,
    syncStatus: "synced",
    syncNote: "Fully imported with comments verified.",
    items: [
      createScenarioItem({
        batchId,
        batchTitle: `Batch ${String(batchNumber).padStart(2, "0")} - ${title}`,
        itemNumber: 1,
        imageUrl: IMAGES[(batchNumber + 1) % IMAGES.length],
        title: `${title} Item 1`,
        baseTimestamp: withOffset(postedAt, 1, 0),
        rawPriceText: "M 180\nS 210\nG 250",
        sizeLabel: "Medium",
        buyerIndexes: [
          batchNumber % BUYERS.length,
          (batchNumber + 1) % BUYERS.length,
          (batchNumber + 2) % BUYERS.length,
        ],
        scenario: "mine-win",
      }),
      createScenarioItem({
        batchId,
        batchTitle: `Batch ${String(batchNumber).padStart(2, "0")} - ${title}`,
        itemNumber: 2,
        imageUrl: IMAGES[(batchNumber + 3) % IMAGES.length],
        title: `${title} Item 2`,
        baseTimestamp: withOffset(postedAt, 4, 10),
        rawPriceText: "M 220\nS 250\nG 290",
        sizeLabel: "Large",
        buyerIndexes: [
          (batchNumber + 3) % BUYERS.length,
          (batchNumber + 4) % BUYERS.length,
          (batchNumber + 5) % BUYERS.length,
        ],
        scenario: "grab-win",
      }),
    ],
  };
}

const ACTIVE_BATCH_BLUEPRINTS: Array<{
  title: string;
  postedAt: string;
  scenarios: ScenarioName[];
  syncStatus: BatchPostSeed["syncStatus"];
  syncNote: string;
}> = [
  {
    title: "Soft Denim Jackets",
    postedAt: "2026-03-15T09:02:00+08:00",
    scenarios: ["mine-win", "grab-win", "cancel-review", "locked-winner"],
    syncStatus: "synced",
    syncNote: "Photos and comment threads are fully synced.",
  },
  {
    title: "Vintage Baby Tees",
    postedAt: "2026-03-15T09:40:00+08:00",
    scenarios: ["steal-win", "mine-win", "missing-price", "manual-winner"],
    syncStatus: "synced",
    syncNote: "Ready for buyer tallying.",
  },
  {
    title: "Korean Office Tops",
    postedAt: "2026-03-15T10:12:00+08:00",
    scenarios: ["mine-win", "no-claim", "grab-win", "manual-unclaimed"],
    syncStatus: "attention",
    syncNote: "One item needs manual check before final totals.",
  },
  {
    title: "Cargo Pants Mix",
    postedAt: "2026-03-15T10:48:00+08:00",
    scenarios: ["grab-win", "mine-win", "steal-win", "mine-win"],
    syncStatus: "synced",
    syncNote: "All photo IDs verified.",
  },
  {
    title: "Preloved Dresses",
    postedAt: "2026-03-15T11:16:00+08:00",
    scenarios: ["mine-win", "cancel-review", "grab-win", "mine-win"],
    syncStatus: "synced",
    syncNote: "Winner scan complete.",
  },
  {
    title: "Weekend Coordinates",
    postedAt: "2026-03-15T12:04:00+08:00",
    scenarios: ["steal-win", "manual-winner", "mine-win", "grab-win"],
    syncStatus: "syncing",
    syncNote: "Latest comments were fetched 3 minutes ago.",
  },
  {
    title: "Neutral Knitwear",
    postedAt: "2026-03-15T12:42:00+08:00",
    scenarios: ["mine-win", "missing-price", "mine-win", "no-claim"],
    syncStatus: "attention",
    syncNote: "Price map is incomplete on one photo caption.",
  },
  {
    title: "Skirt and Shorts Rack",
    postedAt: "2026-03-15T13:15:00+08:00",
    scenarios: ["grab-win", "mine-win", "steal-win", "locked-winner"],
    syncStatus: "synced",
    syncNote: "Batch claim order is stable.",
  },
  {
    title: "Statement Blazers",
    postedAt: "2026-03-15T14:10:00+08:00",
    scenarios: ["manual-winner", "mine-win", "cancel-review", "grab-win"],
    syncStatus: "synced",
    syncNote: "One seller override already recorded.",
  },
  {
    title: "Linen Bottoms",
    postedAt: "2026-03-16T09:00:00+08:00",
    scenarios: ["mine-win", "grab-win", "steal-win", "mine-win"],
    syncStatus: "synced",
    syncNote: "Batch reopened and synced without conflicts.",
  },
  {
    title: "Final Clearance Mix",
    postedAt: "2026-03-16T10:03:00+08:00",
    scenarios: ["no-claim", "mine-win", "manual-unclaimed", "missing-price"],
    syncStatus: "pending",
    syncNote: "Comment sync is queued after photo import finishes.",
  },
];

export function getMockCollectionSeeds(): CollectionSeed[] {
  const activeCollection: CollectionSeed = {
    id: "march-15-16-collection",
    name: "March 15 to 16 Collection",
    startDate: "2026-03-15T00:00:00+08:00",
    endDate: "2026-03-16T23:59:59+08:00",
    status: "open",
    connectedFacebookPage: "Ukay Queen Closet",
    batches: ACTIVE_BATCH_BLUEPRINTS.map((batch, index) =>
      createActiveBatch(
        index + 1,
        batch.title,
        batch.postedAt,
        batch.scenarios,
        batch.syncStatus,
        batch.syncNote,
      ),
    ),
  };

  const februaryCollection: CollectionSeed = {
    id: "february-22-collection",
    name: "February 22 Weekend Collection",
    startDate: "2026-02-22T00:00:00+08:00",
    endDate: "2026-02-22T23:59:59+08:00",
    finalizeDate: "2026-02-23T22:10:00+08:00",
    status: "finalized",
    connectedFacebookPage: "Ukay Queen Closet",
    batches: [
      createArchiveBatch("february-22", 1, "Weekend Tees", "2026-02-22T09:10:00+08:00"),
      createArchiveBatch("february-22", 2, "Denim Skirts", "2026-02-22T10:40:00+08:00"),
      createArchiveBatch("february-22", 3, "Light Jackets", "2026-02-22T13:00:00+08:00"),
    ],
  };

  const januaryCollection: CollectionSeed = {
    id: "january-31-collection",
    name: "January 31 Payday Drop",
    startDate: "2026-01-31T00:00:00+08:00",
    endDate: "2026-02-01T23:59:59+08:00",
    finalizeDate: "2026-02-02T21:45:00+08:00",
    status: "locked",
    connectedFacebookPage: "Ukay Queen Closet",
    batches: [
      createArchiveBatch("january-31", 1, "Graphic Tops", "2026-01-31T09:30:00+08:00"),
      createArchiveBatch("january-31", 2, "Dress Rack", "2026-01-31T11:00:00+08:00"),
    ],
  };

  return [activeCollection, februaryCollection, januaryCollection];
}
