import { ImportedItemSeed } from "@/types";

class ItemPhotoImportService {
  public importItemPhoto(item: ImportedItemSeed): ImportedItemSeed {
    return {
      ...item,
      thumbnailUrl: item.thumbnailUrl || item.imageUrl,
    };
  }
}

export const itemPhotoImportService = new ItemPhotoImportService();
