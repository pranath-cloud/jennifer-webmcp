import { NextRequest, NextResponse, after } from "next/server";
import { exchangeCodeForToken, verifyCallbackHmac, verifyState, SHOPIFY_API_KEY } from "@/lib/shopify/oauth";
import { normalizeShopDomain, upsertShopOnInstall } from "@/lib/db/shops";

/**
 * GET /api/auth/callback?code=..&hmac=..&shop=..&state=..&host=..
 * Shopify OAuth redirect target. Verifies HMAC + state, exchanges the code
 * for a permanent access token, stores it in testing.aisearch_shops, then
 * sends the merchant into the embedded app in Shopify Admin.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shop = normalizeShopDomain(searchParams.get("shop"));
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const host = searchParams.get("host");

  if (!shop || !code || !state) {
    return NextResponse.json({ success: false, error: "Missing shop, code, or state" }, { status: 400 });
  }

  try {
    if (!verifyCallbackHmac(searchParams)) {
      return NextResponse.json({ success: false, error: "Invalid HMAC" }, { status: 403 });
    }
    if (!verifyState(state, shop)) {
      return NextResponse.json({ success: false, error: "Invalid or expired state" }, { status: 403 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }

  try {
    const token = await exchangeCodeForToken(shop, code);
    await upsertShopOnInstall({ shopDomain: shop, accessToken: token.access_token, scope: token.scope });
  } catch (err: any) {
    console.error(`OAuth install failed for ${shop}:`, err);
    return NextResponse.json({ success: false, error: `Install failed: ${err.message}` }, { status: 500 });
  }

  // Install = auto-onboard. Kick off the full catalog sync (index +
  // embeddings) by dispatching the cron-sync endpoint for this shop. The
  // sync function runs on its own Vercel budget once invoked; the 25s
  // cap here only bounds how long we wait for the dispatch. Product
  // webhooks arrive via the app-managed subscriptions in shopify.app.toml
  // (products/create|update|delete → /api/webhooks/shopify).
  after(() => {
    const syncUrl = new URL(`/api/admin/sync-catalog?shop=${encodeURIComponent(shop)}`, request.url);
    return fetch(syncUrl, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      signal: AbortSignal.timeout(25000),
    }).catch((err) =>
      console.warn(`Auto-sync dispatch for ${shop} failed (cron will reconcile):`, err?.message)
    );
  });

  // Embedded app: land the merchant inside Shopify Admin on our app page.
  if (host) {
    return NextResponse.redirect(`https://${shop}/admin/apps/${SHOPIFY_API_KEY}`);
  }
  return NextResponse.redirect(new URL(`/stores?installed=${shop}`, request.url));
}
