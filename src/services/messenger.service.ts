import { FacebookPageRepository } from "@/repositories/facebook-page.repository";
import { MessengerContactRepository } from "@/repositories/messenger-contact.repository";

type MessengerProfileResponse = {
  name?: string;
  first_name?: string;
  last_name?: string;
};

type SendTextMessageParams = {
  recipientPsid: string;
  messageText: string;
};

class MessengerService {
  private readonly graphApiBaseUrl = "https://graph.facebook.com/v23.0";

  public async fetchProfileName(metaPageId: string, senderPsid: string) {
    const pageRecord = await FacebookPageRepository.getPageByMetaPageId(metaPageId);
    const accessToken = pageRecord?.page.access_token?.trim();

    if (!accessToken) {
      return null;
    }

    const url = new URL(`${this.graphApiBaseUrl}/${senderPsid}`);
    url.searchParams.set("fields", "name,first_name,last_name");
    url.searchParams.set("access_token", accessToken);

    try {
      const response = await fetch(url.toString(), { method: "GET" });
      if (!response.ok) {
        return null;
      }

      const payload = await response.json() as MessengerProfileResponse;
      return payload.name?.trim() || null;
    } catch (error) {
      console.error("[MessengerService] Failed to fetch sender profile:", error);
      return null;
    }
  }

  public async syncIncomingContact(params: {
    metaPageId: string;
    senderPsid: string;
    messageText?: string | null;
    timestamp?: number | null;
  }) {
    const senderName = await this.fetchProfileName(params.metaPageId, params.senderPsid);

    return MessengerContactRepository.upsertContact({
      metaPageId: params.metaPageId,
      senderPsid: params.senderPsid,
      senderName,
      lastMessageText: params.messageText ?? null,
      lastMessageAt: params.timestamp ? new Date(params.timestamp).toISOString() : null,
    });
  }

  public async sendTextMessage(metaPageId: string, params: SendTextMessageParams) {
    const pageRecord = await FacebookPageRepository.getPageByMetaPageId(metaPageId);
    const accessToken = pageRecord?.page.access_token?.trim();

    if (!accessToken) {
      throw new Error("Facebook Page access token is not available for Messenger sending.");
    }

    const url = new URL(`${this.graphApiBaseUrl}/${metaPageId}/messages`);
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_type: "RESPONSE",
        recipient: {
          id: params.recipientPsid,
        },
        message: {
          text: params.messageText,
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      const message = typeof payload?.error?.message === "string"
        ? payload.error.message
        : "Meta rejected the Messenger send request.";
      throw new Error(message);
    }

    return payload;
  }
}

export const messengerService = new MessengerService();
