import { BatchPostSeed } from "@/types";
import { itemPhotoImportService } from "@/services/item-photo-import.service";

class BatchPostImportService {
  public importBatchPosts(batches: BatchPostSeed[]): BatchPostSeed[] {
    return batches.map((batch) => ({
      ...batch,
      items: batch.items.map((item) => itemPhotoImportService.importItemPhoto(item)),
    }));
  }
}

export const batchPostImportService = new BatchPostImportService();
