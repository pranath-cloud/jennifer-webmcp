import crypto from "crypto";

// client_id is public (it appears in the install URL) — safe to default.
// SHOPIFY_API_SECRET must come from env; it is never committed.
export const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || "91dfed631fc792173b8196ef7cc6442c";
export const SHOPIFY_SCOPES = process.env.SHOPIFY_API_SCOPES || "read_products,read_inventory";

function getApiSecret(): string {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    throw new Error("SHOPIFY_API_SECRET env var is not set — required for Shopify OAuth/webhooks");
  }
  return secret;
}

export function isValidShopDomain(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
}

/**
 * Stateless OAuth state: "<shop>|<ts>|<nonce>.<hmac>".
 * Valid for STATE_TTL_MS; no DB table needed on serverless.
 */
const STATE_TTL_MS = 10 * 60 * 1000;

export function signState(shop: string): string {
  const payload = `${shop}|${Date.now()}|${crypto.randomBytes(8).toString("hex")}`;
  const sig = crypto.createHmac("sha256", getApiSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyState(state: string, expectedShop: string): boolean {
  const idx = state.lastIndexOf(".");
  if (idx === -1) return false;
  const payload = state.slice(0, idx);
  const sig = state.slice(idx + 1);
  const expected = crypto.createHmac("sha256", getApiSecret()).update(payload).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  const [shop, ts] = payload.split("|");
  if (shop !== expectedShop) return false;
  if (Date.now() - Number(ts) > STATE_TTL_MS) return false;
  return true;
}

/**
 * Verify the OAuth callback HMAC: HMAC-SHA256 over the query params
 * (sorted, hmac/signature removed), per Shopify docs.
 */
export function verifyCallbackHmac(searchParams: URLSearchParams): boolean {
  const hmac = searchParams.get("hmac");
  if (!hmac) return false;

  const pairs: string[] = [];
  searchParams.forEach((value, key) => {
    if (key !== "hmac" && key !== "signature") pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const message = pairs.join("&");

  const digest = crypto.createHmac("sha256", getApiSecret()).update(message).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmac);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Verify an incoming Shopify webhook: HMAC-SHA256 over the RAW body, base64. */
export function verifyWebhookHmac(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false;
  return verifyWebhookHmacWith(rawBody, hmacHeader, getApiSecret());
}

/** Same check against an explicit secret (per-shop custom-app webhooks). */
export function verifyWebhookHmacWith(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader || !secret) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function buildAuthorizeUrl(shop: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: SHOPIFY_API_KEY,
    scope: SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(shop: string, code: string): Promise<{ access_token: string; scope: string }> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: SHOPIFY_API_KEY,
      client_secret: getApiSecret(),
      code,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed for ${shop} [${res.status}]: ${body}`);
  }
  return (await res.json()) as { access_token: string; scope: string };
}
