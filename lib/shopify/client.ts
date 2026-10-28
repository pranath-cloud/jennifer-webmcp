import { getShopAccessToken } from "@/lib/db/shops";

export interface StoreConfig {
  shopDomain?: string;
  accessToken?: string;
  apiVersion?: string;
}

export interface ShopifyGraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, any>;
  }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

// Storefront domain → myshopify domain aliases. Tokens are NEVER stored here —
// they live in testing.aisearch_shops (OAuth installs + seeded legacy tokens)
// or SHOPIFY_ACCESS_TOKEN env for the primary store.
const SHOP_DOMAIN_ALIASES: Record<string, string> = {
  "comfortfurniture.myshopify.com": "jennifercomfortfurniture.myshopify.com",
};

/**
 * Resolves which shop domain a request targets. Keyword matching handles
 * custom storefront domains (e.g. jennihome.com → jennifurniture.myshopify.com).
 * Sync — domain mapping only, no token involved.
 */
export function resolveShopDomain(domain?: string | null): string {
  const defaultDomain = (process.env.SHOPIFY_SHOP_NAME || "jenniferfurniturestaging.myshopify.com").includes(".myshopify.com")
    ? (process.env.SHOPIFY_SHOP_NAME || "jenniferfurniturestaging.myshopify.com")
    : `${process.env.SHOPIFY_SHOP_NAME || "jenniferfurniturestaging"}.myshopify.com`;

  const cleanDomain = domain ? domain.replace(/^https?:\/\//, "").split("/")[0].trim().toLowerCase() : defaultDomain;

  const alias = SHOP_DOMAIN_ALIASES[cleanDomain];
  if (alias) return alias;

  if (cleanDomain.includes("onlinesalesonly") || cleanDomain.includes("sofabed")) return "onlinesalesonly.myshopify.com";
  if (cleanDomain.includes("jennifurniture") || cleanDomain.includes("jennihome")) return "jennifurniture.myshopify.com";
  if (cleanDomain.includes("convertibles") || cleanDomain.includes("jenniferfurniture.com")) return "jennifer-convertibles.myshopify.com";
  if (cleanDomain.includes("comfort")) return "jennifercomfortfurniture.myshopify.com";
  if (cleanDomain.includes("gio-italia") || cleanDomain.includes("klaussner")) return "gio-italia-home.myshopify.com";

  return cleanDomain || defaultDomain;
}

/**
 * Full resolution: shop domain → access token. Checks the OAuth-installed
 * shops table first; falls back to the deprecated hardcoded registry for
 * stores that haven't installed via /api/auth yet.
 */
export async function resolveStoreConfig(domain?: string | null): Promise<{ shopDomain: string; accessToken: string; apiVersion: string }> {
  const shopDomain = resolveShopDomain(domain);
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-04";

  // 1. Token from the shops table (OAuth installs + seeded legacy tokens)
  const storedToken = await getShopAccessToken(shopDomain);
  if (storedToken) {
    return { shopDomain, accessToken: storedToken, apiVersion };
  }

  // 2. Env override — ONLY for the primary store (local dev / break-glass).
  //    An unknown tenant must never be handed the primary store's token:
  //    it would either 401 or, worse, serve another tenant's catalog.
  const primaryDomain = (process.env.SHOPIFY_PRIMARY_DOMAIN || process.env.SHOPIFY_SHOP_NAME || "jenniferfurniturestaging.myshopify.com")
    .replace(/^https?:\/\//, "").split("/")[0].trim().toLowerCase();
  if (process.env.SHOPIFY_ACCESS_TOKEN && shopDomain === primaryDomain) {
    return { shopDomain, accessToken: process.env.SHOPIFY_ACCESS_TOKEN, apiVersion };
  }

  throw new Error(
    `No Shopify access token for ${shopDomain} — install via /api/auth?shop=${shopDomain} or insert into testing.aisearch_shops`
  );
}

export async function shopifyGraphQL<T = any>(
  query: string,
  variables: Record<string, any> = {},
  customConfig?: StoreConfig
): Promise<ShopifyGraphQLResponse<T>> {
  const config = await resolveStoreConfig(customConfig?.shopDomain);
  const endpoint = `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`;

  // No cross-store fallback: if this tenant's credentials fail, surface the
  // error — never serve another store's catalog under their brand.
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": config.accessToken,
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 60 },
  });

  if (response.ok) {
    const result = (await response.json()) as ShopifyGraphQLResponse<T>;
    if (!result.errors || result.errors.length === 0 || result.data) {
      return result;
    }
    throw new Error(
      `Shopify GraphQL errors on ${config.shopDomain}: ${result.errors.map((e) => e.message).join("; ")}`
    );
  }

  const errorBody = await response.text().catch(() => "");
  throw new Error(
    `Shopify API HTTP Error [${response.status}] on ${config.shopDomain}: ${errorBody}`
  );
}

export function getShopDomain(): string {
  return resolveShopDomain();
}
