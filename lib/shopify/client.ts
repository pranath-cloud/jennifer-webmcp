const SHOP_NAME = process.env.SHOPIFY_SHOP_NAME || "jenniferfurniturestaging";
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || "";
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-04";

const SHOP_DOMAIN = SHOP_NAME.includes(".myshopify.com")
  ? SHOP_NAME
  : `${SHOP_NAME}.myshopify.com`;

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

export async function shopifyGraphQL<T = any>(
  query: string,
  variables: Record<string, any> = {}
): Promise<ShopifyGraphQLResponse<T>> {
  if (!ACCESS_TOKEN) {
    throw new Error(
      "SHOPIFY_ACCESS_TOKEN is not configured. Please check your environment variables."
    );
  }

  const endpoint = `https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/graphql.json`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": ACCESS_TOKEN,
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    // Use Next.js caching or revalidation where appropriate
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Shopify API HTTP Error [${response.status}]: ${errorBody}`
    );
  }

  const result = (await response.json()) as ShopifyGraphQLResponse<T>;

  if (result.errors && result.errors.length > 0) {
    console.error("Shopify GraphQL errors:", result.errors);
  }

  return result;
}

export function getShopDomain(): string {
  return SHOP_DOMAIN;
}
