import { getPgPool } from "@/lib/db/postgres";

export interface ShopRecord {
  id?: number;
  shop_domain: string;
  access_token: string;
  scope?: string | null;
  settings?: Record<string, any>;
  installed_at?: string;
  uninstalled_at?: string | null;
  updated_at?: string;
}

// Short-TTL cache so we don't hit Postgres on every GraphQL call.
// Serverless instances each hold their own copy; worst case a token
// change takes up to TOKEN_CACHE_TTL_MS to propagate.
const tokenCache = new Map<string, { token: string | null; ts: number }>();
const TOKEN_CACHE_TTL_MS = 60 * 1000;

export function normalizeShopDomain(domain?: string | null): string {
  return (domain || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];
}

export async function upsertShopOnInstall(input: {
  shopDomain: string;
  accessToken: string;
  scope?: string | null;
  settings?: Record<string, any>;
}): Promise<void> {
  const domain = normalizeShopDomain(input.shopDomain);
  const p = getPgPool();
  await p.query(
    `INSERT INTO testing.aisearch_shops (shop_domain, access_token, scope, settings, installed_at, uninstalled_at, updated_at)
     VALUES ($1, $2, $3, $4, now(), NULL, now())
     ON CONFLICT (shop_domain) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       scope = EXCLUDED.scope,
       settings = COALESCE(testing.aisearch_shops.settings, '{}'::jsonb) || COALESCE(EXCLUDED.settings, '{}'::jsonb),
       uninstalled_at = NULL,
       updated_at = now()`,
    [domain, input.accessToken, input.scope || null, JSON.stringify(input.settings || {})]
  );
  tokenCache.delete(domain);
}

export async function markShopUninstalled(shopDomain: string): Promise<void> {
  const domain = normalizeShopDomain(shopDomain);
  const p = getPgPool();
  await p.query(
    `UPDATE testing.aisearch_shops SET uninstalled_at = now(), updated_at = now() WHERE shop_domain = $1`,
    [domain]
  );
  tokenCache.delete(domain);
}

/**
 * Returns the OAuth access token for an installed shop, or null.
 * Cached for TOKEN_CACHE_TTL_MS per instance.
 */
export async function getShopAccessToken(shopDomain?: string | null): Promise<string | null> {
  const domain = normalizeShopDomain(shopDomain);
  if (!domain) return null;

  const cached = tokenCache.get(domain);
  if (cached && Date.now() - cached.ts < TOKEN_CACHE_TTL_MS) {
    return cached.token;
  }

  try {
    const p = getPgPool();
    const result = await p.query(
      `SELECT access_token FROM testing.aisearch_shops
       WHERE shop_domain = $1 AND uninstalled_at IS NULL`,
      [domain]
    );
    const token = result.rows[0]?.access_token || null;
    tokenCache.set(domain, { token, ts: Date.now() });
    return token;
  } catch (err) {
    console.warn(`aisearch_shops lookup failed for ${domain}:`, err);
    return null;
  }
}

export async function getShopRecord(shopDomain: string): Promise<ShopRecord | null> {
  const domain = normalizeShopDomain(shopDomain);
  if (!domain) return null;
  try {
    const p = getPgPool();
    const result = await p.query(
      `SELECT id, shop_domain, access_token, scope, settings, installed_at, uninstalled_at, updated_at
       FROM testing.aisearch_shops WHERE shop_domain = $1`,
      [domain]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.warn(`aisearch_shops fetch failed for ${domain}:`, err);
    return null;
  }
}

export async function listInstalledShops(): Promise<ShopRecord[]> {
  try {
    const p = getPgPool();
    const result = await p.query(
      `SELECT id, shop_domain, scope, settings, installed_at, uninstalled_at, updated_at
       FROM testing.aisearch_shops ORDER BY installed_at DESC`
    );
    return result.rows;
  } catch (err) {
    console.warn("aisearch_shops list failed:", err);
    return [];
  }
}

/** GDPR shop/redact: drop everything we hold for the shop. */
export async function purgeShopData(shopDomain: string): Promise<void> {
  const domain = normalizeShopDomain(shopDomain);
  if (!domain) return;
  const p = getPgPool();
  // Every table that carries per-shop rows — tokens, v1+v2 telemetry,
  // v1+v2 catalog/content indexes (embeddings live inside the products tables).
  const tables = [
    "aisearch_shops",
    "ai_search_data",
    "ai_search_data_v2",
    "aisearch_products",
    "aisearch_products_v2",
    "aisearch_content",
    "aisearch_content_v2",
  ];
  for (const t of tables) {
    await p.query(`DELETE FROM testing.${t} WHERE shop_domain = $1`, [domain]);
  }
  // Tenant overlay (brand/theme settings) — not Postgres-backed.
  try {
    const { removeStoreByDomain } = await import("@/lib/tenants/registry");
    removeStoreByDomain(domain);
  } catch {}
  // Local telemetry buffer file, same reasoning.
  try {
    const { storage } = await import("@/lib/storage/store-adapter");
    const events = storage.read<any[]>("telemetry.json", []);
    storage.write("telemetry.json", events.filter((e) => e.shopDomain !== domain && normalizeShopDomain(e.shopDomain) !== domain));
  } catch {}
  tokenCache.delete(domain);
}
