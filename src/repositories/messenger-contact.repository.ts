import { getServiceSupabase } from "@/lib/supabase";
import { winnerIntegrityService } from "@/services/winner-integrity.service";

type UpsertMessengerContactInput = {
  metaPageId: string;
  senderPsid: string;
  senderName?: string | null;
  lastMessageText?: string | null;
  lastMessageAt?: string | null;
};

export class MessengerContactRepository {
  static async upsertContact(input: UpsertMessengerContactInput) {
    const normalizedName = winnerIntegrityService.normalizeBuyerName(input.senderName ?? null);
    const { error } = await getServiceSupabase()
      .from("messenger_contacts")
      .upsert({
        meta_page_id: input.metaPageId,
        sender_psid: input.senderPsid,
        sender_name: input.senderName ?? null,
        sender_name_normalized: normalizedName?.toLocaleLowerCase() ?? null,
        last_message_text: input.lastMessageText ?? null,
        last_message_at: input.lastMessageAt ?? new Date().toISOString(),
      }, { onConflict: "meta_page_id,sender_psid" });

    if (error) {
      console.error("Error upserting messenger contact:", error);
      return false;
    }

    return true;
  }

  static async findRecipientForBuyer(metaPageId: string, buyerName: string) {
    const normalizedBuyerName = winnerIntegrityService.normalizeBuyerName(buyerName)?.toLocaleLowerCase();
    if (!normalizedBuyerName) {
      return null;
    }

    const { data, error } = await getServiceSupabase()
      .from("messenger_contacts")
      .select("sender_psid, sender_name, last_message_at")
      .eq("meta_page_id", metaPageId)
      .eq("sender_name_normalized", normalizedBuyerName)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error looking up messenger recipient for buyer:", error);
      return null;
    }

    return data
      ? {
          senderPsid: data.sender_psid as string,
          senderName: (data.sender_name as string | null | undefined) ?? null,
          lastMessageAt: (data.last_message_at as string | null | undefined) ?? null,
        }
      : null;
  }
}
