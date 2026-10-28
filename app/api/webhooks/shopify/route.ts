import { NextRequest, NextResponse, after } from "next/server";
import { verifyWebhookHmac, verifyWebhookHmacWith } from "@/lib/shopify/oauth";
import { markShopUninstalled, normalizeShopDomain, purgeShopData, getShopRecord } from "@/lib/db/shops";
import { shopifyGraphQL } from "@/lib/shopify/client";
import { normalizeProductSummary } from "@/lib/shopify/normalizer";
import {
  upsertProductsToIndex, deleteProductFromIndex, upsertProductEmbeddings,
  getProductEmbedState, productSearchText,
} from "@/lib/db/products_v2";
import { embedTexts, embedImages, productEmbeddingText } from "@/lib/ai/embeddings";

/**
 * POST /api/webhooks/shopify
 * HMAC-verified against SHOPIFY_API_SECRET, falling back to the shop's own
 * custom-app secret (aisearch_shops.settings.webhook_secret) — product
 * webhooks registered via a shpat_ custom-app token are signed by THAT app.
 *
 * Topics:
 *  - products/create|update  → refetch → reindex → embed text + photo
 *  - products/delete         → archive row + drop vectors
 *  - app/uninstalled         → flag the shop inactive (keep token row)
 *  - customers/*, shop/redact → compliance acks / purge
 *
 * Product processing runs in after() — Shopify gets its 200 immediately,
 * the ~1.5s index+embed work continues after the response.
 */

const WEBHOOK_PRODUCT_QUERY = `
  query ProductForIndex($id: ID!) {
    product(id: $id) {
      id title handle vendor productType status publishedAt tags totalInventory
      featuredImage { url altText }
      priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
      options { name values }
      collections(first: 3) { edges { node { title handle } } }
      metafields(first: 10) { edges { node { namespace key value type } } }
      variants(first: 20) {
        edges { node { id title sku price compareAtPrice availableForSale inventoryQuantity image { url } selectedOptions { name value } } }
      }
    }
  }
`;

async function handleProductWebhook(shop: string, topic: string, payload: any) {
  const gid = payload.admin_graphql_api_id || `gid://shopify/Product/${payload.id}`;

  if (topic === "products/delete") {
    await deleteProductFromIndex(shop, gid);
    console.log(`[webhook] ${topic} — archived ${gid} (${shop})`);
    return;
  }

  const resp: any = await shopifyGraphQL<any>(WEBHOOK_PRODUCT_QUERY, { id: gid }, { shopDomain: shop });
  const node = resp.data?.product;
  // Draft/archived/missing products must leave the searchable index entirely.
  if (!node || node.status !== "ACTIVE") {
    await deleteProductFromIndex(shop, gid);
    console.log(`[webhook] ${topic} — ${gid} is ${node?.status || "gone"}, archived (${shop})`);
    return;
  }

  const s: any = normalizeProductSummary(node);
  s.skuList = (node.variants?.edges || []).map((v: any) => v.node?.sku).filter(Boolean);
  await upsertProductsToIndex(shop, [s]);

  // Embed only what actually changed — searchable text drift or a swapped
  // featured photo. An unchanged product update (e.g. inventory bump)
  // costs zero embedding calls.
  const pid = String(s.id || s.productId || s.handle);
  const st = await getProductEmbedState(shop, pid);
  const featuredUrl = typeof s.featuredImage === "string" && s.featuredImage.startsWith("http") ? s.featuredImage : null;
  const needText = !st?.hasText || st.searchText !== productSearchText(s);
  const needImg = Boolean(featuredUrl && (!st?.hasImg || st.embeddedImageUrl !== featuredUrl));
  const clearImg = !featuredUrl && !!st?.hasImg;

  const row: { product_id: string; embedding?: number[]; image_embedding?: number[] | null; image_url?: string } = { product_id: pid };
  if (needText) row.embedding = (await embedTexts([productEmbeddingText(s)]))[0] || [];
  if (needImg) {
    const v = (await embedImages([featuredUrl!]))[0] || [];
    row.image_embedding = v.length ? v : null; // null clears a stale/mismatched vec; retried next sync
    if (v.length) row.image_url = featuredUrl!;
  } else if (clearImg) {
    row.image_embedding = null;
  }
  if (row.embedding || row.image_embedding !== undefined) {
    await upsertProductEmbeddings(shop, [row]);
  }
  console.log(`[webhook] ${topic} — indexed ${pid} (${shop}) text:${needText ? "re-embedded" : "fresh"} img:${needImg ? "re-embedded" : clearImg ? "cleared" : "fresh"}`);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  const topic = request.headers.get("x-shopify-topic");
  const shop = normalizeShopDomain(request.headers.get("x-shopify-shop-domain"));

  let verified = false;
  try {
    verified = verifyWebhookHmac(rawBody, hmac);
    if (!verified && shop) {
      const rec = await getShopRecord(shop).catch(() => null);
      const alt = (rec?.settings as any)?.webhook_secret;
      if (alt) verified = verifyWebhookHmacWith(rawBody, hmac, alt);
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
  if (!verified) {
    return NextResponse.json({ success: false, error: "Invalid webhook HMAC" }, { status: 401 });
  }

  try {
    switch (topic) {
      case "products/create":
      case "products/update":
      case "products/delete": {
        const payload = JSON.parse(rawBody);
        after(() =>
          handleProductWebhook(shop, topic, payload).catch((e) =>
            console.error(`[webhook] ${topic} handler failed for ${shop}:`, e)
          )
        );
        break;
      }
      case "app/uninstalled":
        await markShopUninstalled(shop);
        console.log(`[webhook] app/uninstalled — ${shop}`);
        break;
      case "shop/redact":
        await purgeShopData(shop);
        console.log(`[webhook] shop/redact — purged data for ${shop}`);
        break;
      case "customers/data_request":
      case "customers/redact":
        // We store shop credentials + anonymous session telemetry only —
        // no customer PII. Acknowledge per Shopify requirements.
        console.log(`[webhook] ${topic} — ${shop} (no customer PII held)`);
        break;
      default:
        console.log(`[webhook] unhandled topic ${topic} — ${shop}`);
    }
  } catch (err: any) {
    console.error(`[webhook] ${topic} failed for ${shop}:`, err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
