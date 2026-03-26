import { BuyerTotalSummary } from "@/types";
import { formatCurrency } from "@/lib/format";

const PICKUP_SCHEDULE_DAY = "MONDAY";
const PICKUP_SCHEDULE_DATE = "MARCH 30, 2026";
const PICKUP_TIME = "1PM-6PM";
const SHIPPING_PAYMENT_DATE = "MARCH 25, 2026";
const SHIPPING_SCHEDULE_DAY = "MONDAY";
const SHIPPING_SCHEDULE_DATE = "MARCH 30, 2026";

export type BuyerInvoiceType = "pickup" | "shipping";

export function buildBuyerItemsText(buyer: BuyerTotalSummary) {
  return buyer.items
    .map((item) => `Item #${String(item.itemNumber).padStart(2, "0")} - ${formatCurrency(item.resolvedPrice)}`)
    .join("\n");
}

export function buildPickupInvoice(buyer: BuyerTotalSummary) {
  return `GENSAN MINERS:
PICK UP Schedule: ${PICKUP_SCHEDULE_DAY} | ${PICKUP_SCHEDULE_DATE}
TIME: ${PICKUP_TIME}

Open from MON-SAT (9am-6pm)
MUST READ!!
HINDI PO AKO TUMATANGGAP NG PAYMENT UPON PICK UP SA BOX, ALL PAYMENTS AY GCASH/BANK TRANSFER ONLY.

KUNG MAGPADELIVER, PM YOUR COMPLETE DETAILS WITH PIN LOCATION SA MAXIM

PICK UP LOCATION: Urban Essence Box 'N Style
Laurel Avenue, Dadiangas East near SM GENSAN
BOX #36
Opens from 11am-6pm every Mondays to Saturday.


RCBC:
7591195098
Dayanara gutierrez

PAYMAYA:
Dayanara Gutierrez
09186441239

GCASH:
DAYANARA G.
09186441239

BE RESPONSIBLE BUYER PLEASE.
BOGUS BUYER ipopost ko!!

READ FROM THE TOP!!

2 DAYS REVERVATION ONLY

Item/s:
${buildBuyerItemsText(buyer)}
TOTAL: ${formatCurrency(buyer.totalAmount)}`;
}

export function buildShippingInvoice(buyer: BuyerTotalSummary, shippingFee: number) {
  return `FOR SHIPPING ITEMS:

RCBC:
7591195098
DAYANARA M. GUTIERREZ

GCASH
09186441239
Dayanara G.

PAYMAYA:
Dayanara Gutierrez
09186441239

For Shipping items:
PAYMENT: TONIGHT (${SHIPPING_PAYMENT_DATE})
SHIPPING SCHEDULE: ${SHIPPING_SCHEDULE_DAY} (${SHIPPING_SCHEDULE_DATE})
- walang magpadelay ng payment. Same lng tayo busy. Please settle your payment LATER!

LAHAT NG TRACKING NUMBERS POSTED PO SA PAGE ONCE NASHIP NA NAMIN ITEMS NYO.

BE RESPONSIBLE BUYER PLEASE.
BOGUS BUYER ipopost ko!!

READ FROM THE TOP!!

Item/s:
${buildBuyerItemsText(buyer)}
SUBTOTAL: ${formatCurrency(buyer.totalAmount)}
SHIPPING FEE: ${formatCurrency(shippingFee)}
TOTAL: ${formatCurrency(buyer.totalAmount + shippingFee)}`;
}

export function buildInvoiceForType(
  buyer: BuyerTotalSummary,
  type: BuyerInvoiceType,
  shippingFee = 0,
) {
  return type === "pickup"
    ? buildPickupInvoice(buyer)
    : buildShippingInvoice(buyer, shippingFee);
}
