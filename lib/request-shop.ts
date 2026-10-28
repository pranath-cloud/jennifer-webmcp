import { NextRequest } from "next/server";
import { getStoreByDomain } from "@/lib/tenants/registry";

/**
 * Resolve which Shopify tenant a request belongs to.
 * Order: explicit body params (shop_domain / shopDomain / shop / store)
 *   -> X-Shop-Domain header
 *   -> ?shop= / ?shop_domain= query params
 *   -> Origin/Referer host mapped through the tenant registry
 *     (browser WebMCP agents always send Origin, so a tool call fired from
 *     jennihome.com resolves to the jennihome tenant with zero config)
 * Returns undefined when nothing resolves — callers fall back to the
 * default/primary store exactly as they did before.
 * (Named *Request*ShopDomain to avoid collision with the domain-string
 * resolver in lib/shopify/client.ts.)
 */
export function resolveRequestShopDomain(request: NextRequest, body?: any): string | undefined {
  const direct =
    body?.shop_domain || body?.shopDomain || body?.shop || body?.store ||
    request.headers.get("x-shop-domain") ||
    request.nextUrl?.searchParams?.get("shop") ||
    request.nextUrl?.searchParams?.get("shop_domain");
  if (direct) return String(direct).trim();

  const origin = request.headers.get("origin") || request.headers.get("referer") || "";
  const host = origin.replace(/^https?:\/\//, "").split("/")[0].trim();
  if (!host) return undefined;

  return getStoreByDomain(host)?.shopDomain;
}
