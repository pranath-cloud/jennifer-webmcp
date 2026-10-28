import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { shopifyGraphQL } from "@/lib/shopify/client";
import { normalizeProductSummary } from "@/lib/shopify/normalizer";
import { upsertProductsToIndex, upsertContentToIndex, upsertProductEmbeddings, upsertContentEmbeddings, getUnembeddedProductIds } from "@/lib/db/products_v2";
import { embedTexts, embedImages, productEmbeddingText } from "@/lib/ai/embeddings";

/**
 * POST /api/admin/sync-catalog { shop_domain }
 * Full catalog sync into testing.aisearch_products — the Phase 3 local index.
 * Runs inside Next so it reuses the real client + normalizer. Admin-gated.
 */
const SYNC_QUERY = `
  query SyncCatalog($cursor: String) {
    products(first: 250, after: $cursor, query: "status:active") {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          vendor
          productType
          status
          publishedAt
          tags
          totalInventory
          featuredImage { url altText }
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          options { name values }
          collections(first: 3) { edges { node { title handle } } }
          metafields(first: 10) { edges { node { namespace key value type } } }
          variants(first: 20) {
            edges {
              node {
                id title sku price compareAtPrice availableForSale
                inventoryQuantity
                image { url }
                selectedOptions { name value }
              }
            }
          }
        }
      }
    }
  }
`;

const CONTENT_QUERY = `
  query SyncContent {
    collections(first: 250) {
      edges { node { id title handle description } }
    }
  }
`;

// Pages & articles need read_content scope — custom-app tokens don't carry it,
// and storefront sitemaps are public anyway. Crawl them instead: this is the
// same universal mechanism any future (non-Shopify) site would use.
async function syncSiteContentViaSitemap(shopDomain: string): Promise<{ synced: number; error?: string }> {
  const items: any[] = [];
  try {
    const sitemapResp = await fetch(`https://${shopDomain}/sitemap.xml`, { redirect: "follow" });
    if (!sitemapResp.ok) return { synced: 0, error: `sitemap ${sitemapResp.status}` };
    const sitemapXml = await sitemapResp.text();
    const childSitemaps = [...sitemapXml.matchAll(/<loc>([^<]*sitemap_(?:pages|blogs|articles)[^<]*)<\/loc>/g)].map((m) => m[1]);

    const pageUrls: { url: string; type: string }[] = [];
    for (const sm of childSitemaps.slice(0, 4)) {
      const xml = await (await fetch(sm)).text();
      for (const m of xml.matchAll(/<loc>([^<]*)<\/loc>/g)) {
        const u = m[1];
        const isBlogPost = /\/blogs\/[^/]+\/[^/]+/.test(u);
        const isBlogRoot = /\/blogs\/[^/]+$/.test(u);
        pageUrls.push({ url: u, type: isBlogPost ? "article" : isBlogRoot ? "blog" : "page" });
      }
    }

    // Parallel batches of 10 — serial crawling blows the function timeout
    const toFetch = pageUrls.slice(0, 160);
    for (let i = 0; i < toFetch.length; i += 10) {
      const batch = await Promise.all(toFetch.slice(i, i + 10).map(async (p) => {
        try {
          const html = await (await fetch(p.url, { signal: AbortSignal.timeout(8000) })).text();
          const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").split("|")[0].split("–")[0].replace(/&ndash;|&mdash;/g, "—").replace(/&amp;/g, "&").replace(/&[a-z]+;|&#\d+;/gi, "").replace(/\s+/g, " ").trim();
          const bodyMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          const body = stripHtml(bodyMatch ? bodyMatch[1] : "").slice(0, 3000);
          const handle = p.url.split("/").filter(Boolean).pop() || "";
          return title ? { type: p.type, id: p.url, title, handle, body, url: new URL(p.url).pathname } : null;
        } catch { return null; }
      }));
      for (const it of batch) if (it) items.push(it);
    }
    if (items.length > 0) await upsertContentToIndex(shopDomain, items);
    return { synced: items.length };
  } catch (e: any) {
    return { synced: 0, error: e.message || "sitemap sync failed" };
  }
}

function stripHtml(s: string): string {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&ndash;|&mdash;/g, "-").replace(/&#\d+;|&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

async function syncContent(shopDomain: string): Promise<{ synced: number; error?: string }> {
  try {
    const resp: any = await shopifyGraphQL<any>(CONTENT_QUERY, {}, { shopDomain });
    if (resp.errors?.length) return { synced: 0, error: resp.errors[0]?.message || "graphql error" };
    const items: any[] = [];
    for (const c of resp.data?.collections?.edges || []) {
      items.push({ type: "collection", id: c.node.id, title: c.node.title, handle: c.node.handle, body: stripHtml(c.node.description), url: `/collections/${c.node.handle}` });
    }
    await upsertContentToIndex(shopDomain, items);

    // Pages + articles via public sitemap (no read_content scope needed)
    const site = await syncSiteContentViaSitemap(shopDomain);
    return { synced: items.length + site.synced, ...(site.error ? { error: site.error } : {}) };
  } catch (e: any) {
    return { synced: 0, error: e.message || "content sync failed" };
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

async function runSync(shopDomain: string) {
    let cursor: string | null = null;
    let pages = 0;
    let synced = 0;
    const started = Date.now();
    const allSummaries: any[] = [];

    do {
      const resp: any = await shopifyGraphQL<any>(SYNC_QUERY, { cursor }, { shopDomain });
      const conn: any = resp.data?.products;
      const edges = conn?.edges || [];
      if (edges.length === 0) break;

      const summaries = edges.map((e: any) => {
        const s: any = normalizeProductSummary(e.node);
        s.skuList = (e.node.variants?.edges || [])
          .map((v: any) => v.node?.sku)
          .filter(Boolean);
        return s;
      });

      await upsertProductsToIndex(shopDomain, summaries);
      allSummaries.push(...summaries);
      synced += summaries.length;
      pages++;

      cursor = conn?.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null;
    } while (cursor && pages < 100);

    // Semantic layer — embed only products missing an embedding (incremental;
    // re-syncs don't re-embed the whole catalog). Capped so big catalogs
    // don't blow the function timeout — backfill script covers the rest.
    let embedded = 0;
    const unembedded = new Set(await getUnembeddedProductIds(shopDomain));
    const toEmbed = allSummaries.filter((s) =>
      unembedded.has(String(s.id || s.productId || s.handle))
    ).slice(0, 1500);
    for (let i = 0; i < toEmbed.length; i += 48) {
      const batch = toEmbed.slice(i, i + 48);
      const vecs = await embedTexts(batch.map(productEmbeddingText));
      const imgUrls = batch.map((s: any) => (typeof s.featuredImage === "string" && s.featuredImage.startsWith("http") ? s.featuredImage : null));
      const validIdx = imgUrls.map((u: string | null, j: number) => (u ? j : -1)).filter((j: number) => j >= 0);
      const imgVecs = validIdx.length ? await embedImages(validIdx.map((j: number) => imgUrls[j] as string)) : [];
      const rows = batch
        .map((s, j) => {
          const iv = imgUrls[j] ? (imgVecs[validIdx.indexOf(j)] || null) : null;
          return {
            product_id: String(s.id || s.productId || s.handle),
            embedding: vecs[j] || [],
            image_embedding: iv,
            image_url: iv ? imgUrls[j] : undefined,
          };
        })
        .filter((r) => r.embedding.length > 0 || r.image_embedding);
      if (rows.length > 0) await upsertProductEmbeddings(shopDomain, rows);
      embedded += rows.length;
    }

    const content = await syncContent(shopDomain);

    return {
      success: true,
      shop_domain: shopDomain,
      products_synced: synced,
      products_embedded: embedded,
      content_synced: content.synced,
      ...(content.error ? { content_error: content.error } : {}),
      pages,
      elapsed_ms: Date.now() - started,
    };
}

export async function POST(request: NextRequest) {
  if (!verifyAdminAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const shopDomain = body.shop_domain || body.shop;
    if (!shopDomain) {
      return NextResponse.json({ success: false, error: "shop_domain required" }, { status: 400, headers: corsHeaders });
    }
    return NextResponse.json(await runSync(shopDomain), { headers: corsHeaders });
  } catch (error: any) {
    console.error("Catalog sync error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

/**
 * GET /api/admin/sync-catalog?shop=<domain> — Vercel cron entry.
 * Nightly reconcile: re-upserts catalog, embeds only what's missing or
 * whose featured photo changed, re-crawls content. Catches every webhook
 * miss (dropped events, bulk CSV imports, fixed image URLs).
 */
export async function GET(request: NextRequest) {
  const cronOk = process.env.CRON_SECRET &&
    request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk && !verifyAdminAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }
  try {
    const shopDomain = request.nextUrl.searchParams.get("shop") || "jennifurniture.myshopify.com";
    return NextResponse.json(await runSync(shopDomain), { headers: corsHeaders });
  } catch (error: any) {
    console.error("Catalog sync (GET) error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
