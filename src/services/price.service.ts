import { ClaimCodeMapping, ClaimWord, PriceMap } from "@/types";

const PRICE_KEYS: ClaimWord[] = ["mine", "steal", "grab"];

class PriceService {
  public parseRawPriceText(rawPriceText: string, claimCodeMapping: ClaimCodeMapping): PriceMap {
    const priceMap: PriceMap = {};
    const normalized = rawPriceText.toUpperCase().trim();

    // First, look for specific mappings like "M:100 S:200" or "M100 S200".
    const matches = normalized.matchAll(
      /([A-Z])\s*(?:[:=-]|(?:\s+))?\s*(?:PHP|P|\u20B1)?\s*(\d{2,5})/g,
    );

    let codesFound = false;
    for (const match of matches) {
      const code = match[1];
      const amount = Number(match[2]);
      const claimWord = claimCodeMapping[code];

      if (claimWord && Number.isFinite(amount)) {
        priceMap[claimWord] = amount;
        codesFound = true;
      }
    }

    // If no specific codes were found and the whole text is a single amount, apply it to all claim words.
    if (!codesFound) {
      const singleNumberMatch = normalized.match(/^(?:PHP|P|\u20B1)?\s*(\d{2,5})$/);
      if (singleNumberMatch) {
        const amount = Number(singleNumberMatch[1]);
        if (Number.isFinite(amount)) {
          Object.values(claimCodeMapping).forEach((word) => {
            if (word) {
              priceMap[word] = amount;
            }
          });
        }
      }
    }

    // Fallback for generic captions such as "100 EACH" repeated across multiple lines.
    if (!codesFound && Object.keys(priceMap).length === 0) {
      const genericAmounts = this.extractGenericAmounts(normalized);
      if (genericAmounts.length === 1) {
        const amount = genericAmounts[0];
        Object.values(claimCodeMapping).forEach((word) => {
          if (word) {
            priceMap[word] = amount;
          }
        });
      }
    }

    return priceMap;
  }

  public resolvePrice(priceMap: PriceMap, claimWord: ClaimWord | null | undefined): number | null {
    if (!claimWord) {
      return null;
    }

    const amount = priceMap[claimWord];
    return typeof amount === "number" ? amount : null;
  }

  public getOrderedEntries(priceMap: PriceMap): Array<[ClaimWord, number]> {
    return PRICE_KEYS.flatMap((key) =>
      typeof priceMap[key] === "number" ? [[key, priceMap[key] as number]] : [],
    );
  }

  private extractGenericAmounts(normalizedText: string) {
    const amounts = new Set<number>();
    const lines = normalizedText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const eachMatch = line.match(
        /(?:^|[\s:=-])(?:PHP|P|\u20B1)?\s*(\d{2,5})\s*(?:EACH|EA|ONLY|\/EA|\/PC|PER\s+PIECE|PER\s+PC|PESOS?)\b/,
      );
      if (eachMatch) {
        amounts.add(Number(eachMatch[1]));
        continue;
      }

      const simpleLineMatch = line.match(/^(?:PHP|P|\u20B1)?\s*(\d{2,5})$/);
      if (simpleLineMatch) {
        amounts.add(Number(simpleLineMatch[1]));
      }
    }

    return [...amounts].filter((amount) => Number.isFinite(amount));
  }
}

export const priceService = new PriceService();
