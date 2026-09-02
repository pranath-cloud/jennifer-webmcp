import { getShopDomain } from "./client";
import { CheckoutHandoffResult } from "@/lib/types/shopify";

/**
 * Generates a valid Shopify Cart Permalink
 * Format: https://{shop}.myshopify.com/cart/{variant_id}:{quantity},{variant_id}:{quantity}?discount={code}
 */
export function generateCartPermalink(
  items: Array<{
    variantId: string; // gid://shopify/ProductVariant/12345 or "12345"
    quantity: number;
    title?: string;
    price?: number;
  }>,
  discountCode?: string | null,
  note?: string | null
): CheckoutHandoffResult {
  const shopDomain = getShopDomain();

  const formattedLineItems = items.map((item) => {
    // Extract numeric ID from Global ID if provided
    const numericId = item.variantId.includes("/")
      ? item.variantId.split("/").pop() || item.variantId
      : item.variantId;

    const qty = Math.max(1, Math.floor(item.quantity || 1));
    const price = item.price || 0;

    return {
      variantId: item.variantId,
      variantNumericId: numericId,
      title: item.title || "Selected Furniture Item",
      quantity: qty,
      price,
    };
  });

  const cartPath = formattedLineItems
    .map((li) => `${li.variantNumericId}:${li.quantity}`)
    .join(",");

  const urlParams = new URLSearchParams();
  if (discountCode && discountCode.trim()) {
    urlParams.set("discount", discountCode.trim());
  }
  if (note && note.trim()) {
    urlParams.set("note", note.trim());
  }

  const queryString = urlParams.toString();
  const checkoutUrl = `https://${shopDomain}/cart/${cartPath}${queryString ? `?${queryString}` : ""}`;

  const estimatedTotal = formattedLineItems.reduce(
    (sum, li) => sum + li.price * li.quantity,
    0
  );

  return {
    checkoutUrl,
    shopDomain,
    lineItems: formattedLineItems,
    estimatedTotal,
    discountCodeApplied: discountCode || null,
    expiresIn: "Direct Link (Valid as long as inventory remains in stock)",
  };
}
