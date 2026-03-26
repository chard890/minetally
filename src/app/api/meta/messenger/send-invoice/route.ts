import { NextRequest, NextResponse } from "next/server";
import { buildInvoiceForType, BuyerInvoiceType } from "@/lib/buyer-invoice";
import { collectionService } from "@/services/collection.service";
import { FacebookPageRepository } from "@/repositories/facebook-page.repository";
import { MessengerContactRepository } from "@/repositories/messenger-contact.repository";
import { messengerService } from "@/services/messenger.service";

type SendInvoiceRequestBody = {
  collectionId?: string;
  buyerId?: string;
  invoiceType?: BuyerInvoiceType;
  shippingFee?: number;
};

export async function POST(request: NextRequest) {
  let body: SendInvoiceRequestBody;

  try {
    body = await request.json() as SendInvoiceRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const collectionId = body.collectionId?.trim();
  const buyerId = body.buyerId?.trim();
  const invoiceType = body.invoiceType;
  const shippingFee = typeof body.shippingFee === "number" ? body.shippingFee : 0;

  if (!collectionId || !buyerId || !invoiceType) {
    return NextResponse.json(
      { error: "collectionId, buyerId, and invoiceType are required." },
      { status: 400 },
    );
  }

  if (invoiceType === "shipping" && shippingFee < 0) {
    return NextResponse.json(
      { error: "Shipping fee must be zero or greater." },
      { status: 400 },
    );
  }

  const [buyer, page] = await Promise.all([
    collectionService.getBuyerDetail(collectionId, buyerId),
    FacebookPageRepository.getConnectedPage(),
  ]);

  if (!buyer) {
    return NextResponse.json({ error: "Buyer was not found for this collection." }, { status: 404 });
  }

  if (!page?.id) {
    return NextResponse.json(
      { error: "No connected Facebook Page is available for Messenger sending." },
      { status: 400 },
    );
  }

  const recipient = await MessengerContactRepository.findRecipientForBuyer(page.id, buyer.buyerName);
  if (!recipient?.senderPsid) {
    return NextResponse.json(
      {
        error: `No Messenger recipient is linked for ${buyer.buyerName}. Ask the buyer to message the Page first using the same Facebook profile name.`,
      },
      { status: 400 },
    );
  }

  const invoiceText = buildInvoiceForType(buyer, invoiceType, shippingFee);

  try {
    await messengerService.sendTextMessage(page.id, {
      recipientPsid: recipient.senderPsid,
      messageText: invoiceText,
    });

    return NextResponse.json({
      success: true,
      recipientName: recipient.senderName ?? buyer.buyerName,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send Messenger invoice.",
      },
      { status: 400 },
    );
  }
}
