import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { messengerService } from "@/services/messenger.service";

type MessengerWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    messaging?: Array<{
      sender?: { id?: string };
      recipient?: { id?: string };
      timestamp?: number;
      message?: {
        mid?: string;
        text?: string;
      };
      postback?: {
        payload?: string;
        title?: string;
      };
    }>;
  }>;
};

function getVerifyToken() {
  return process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ?? "";
}

function getAppSecret() {
  return process.env.FACEBOOK_APP_SECRET?.trim() ?? "";
}

function createSignature(payload: string, secret: string) {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

function signaturesMatch(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function verifyRequestSignature(request: NextRequest, rawBody: string) {
  const appSecret = getAppSecret();
  const providedSignature = request.headers.get("x-hub-signature-256");

  if (!appSecret || !providedSignature) {
    return false;
  }

  const expectedSignature = createSignature(rawBody, appSecret);
  return signaturesMatch(expectedSignature, providedSignature);
}

function summarizePayload(payload: MessengerWebhookPayload) {
  return (payload.entry ?? []).flatMap((entry) =>
    (entry.messaging ?? []).map((event) => ({
      pageId: entry.id ?? null,
      senderId: event.sender?.id ?? null,
      recipientId: event.recipient?.id ?? null,
      timestamp: event.timestamp ?? null,
      messageId: event.message?.mid ?? null,
      messageText: event.message?.text ?? null,
      postbackPayload: event.postback?.payload ?? null,
      postbackTitle: event.postback?.title ?? null,
    })),
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = getVerifyToken();

  if (!verifyToken) {
    return NextResponse.json(
      { error: "META_WEBHOOK_VERIFY_TOKEN is not configured." },
      { status: 500 },
    );
  }

  if (mode !== "subscribe" || token !== verifyToken || !challenge) {
    return NextResponse.json(
      { error: "Webhook verification failed." },
      { status: 403 },
    );
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifyRequestSignature(request, rawBody)) {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 401 },
    );
  }

  let payload: MessengerWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as MessengerWebhookPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  if (payload.object !== "page") {
    return NextResponse.json(
      { error: "Unsupported webhook object." },
      { status: 400 },
    );
  }

  const events = summarizePayload(payload);

  if (events.length > 0) {
    console.log("[MessengerWebhook] Received events", events);
    await Promise.all(events.map(async (event) => {
      if (!event.pageId || !event.senderId) {
        return;
      }

      await messengerService.syncIncomingContact({
        metaPageId: event.pageId,
        senderPsid: event.senderId,
        messageText: event.messageText,
        timestamp: event.timestamp,
      });
    }));
  } else {
    console.log("[MessengerWebhook] Received payload with no messaging events");
  }

  return NextResponse.json({ received: true });
}
