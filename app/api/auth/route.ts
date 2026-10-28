import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl, isValidShopDomain, signState } from "@/lib/shopify/oauth";
import { normalizeShopDomain } from "@/lib/db/shops";

/**
 * GET /api/auth?shop=<shop>.myshopify.com
 * Entry point for the AISearch app install. Redirects the merchant to
 * Shopify's OAuth consent screen where they approve the requested scopes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shop = normalizeShopDomain(searchParams.get("shop"));

  if (!isValidShopDomain(shop)) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid ?shop= param — expected <store>.myshopify.com" },
      { status: 400 }
    );
  }

  let redirectUri: string;
  let state: string;
  try {
    redirectUri = new URL("/api/auth/callback", request.url).toString();
    state = signState(shop);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }

  return NextResponse.redirect(buildAuthorizeUrl(shop, redirectUri, state));
}
