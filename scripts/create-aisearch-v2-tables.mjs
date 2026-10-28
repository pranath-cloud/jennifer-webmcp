/**
 * V2 AI Search index tables — fully separate from v1 (aisearch_products).
 * Adds `embedding jsonb` (float array) for the semantic/vector search leg.
 * Run: node scripts/create-aisearch-v2-tables.mjs
 */
import pg from "pg";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
process.env = { ...process.env, ...env };

const pool = new pg.Pool({
  host: env.PG_HOST || "44.194.110.48",
  port: parseInt(env.PG_PORT || "5000"),
  database: env.PG_DATABASE || "nifi_poc",
  user: env.PG_USER || "utkarsh",
  password: env.PG_PASSWORD,
  max: 3,
});

async function main() {
  const c = await pool.connect();
  try {
    await c.query(`
      CREATE TABLE IF NOT EXISTS testing.aisearch_products_v2 (
        id BIGSERIAL PRIMARY KEY,
        shop_domain TEXT NOT NULL,
        product_id TEXT NOT NULL,
        handle TEXT,
        title TEXT,
        vendor TEXT,
        product_type TEXT,
        tags JSONB DEFAULT '[]',
        sku_list JSONB DEFAULT '[]',
        min_price NUMERIC,
        max_price NUMERIC,
        total_inventory INT DEFAULT 0,
        status TEXT DEFAULT 'active',
        summary JSONB,
        search_text TEXT,
        embedding JSONB,
        synced_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE (shop_domain, product_id)
      )
    `);
    await c.query(`CREATE INDEX IF NOT EXISTS aisearch_products_v2_shop ON testing.aisearch_products_v2 (shop_domain, status)`);
    await c.query(`CREATE INDEX IF NOT EXISTS aisearch_products_v2_fts ON testing.aisearch_products_v2
      USING gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(vendor,'') || ' ' || coalesce(product_type,'') || ' ' || coalesce(search_text,'')))`);

    await c.query(`
      CREATE TABLE IF NOT EXISTS testing.aisearch_content_v2 (
        id BIGSERIAL PRIMARY KEY,
        shop_domain TEXT NOT NULL,
        content_type TEXT NOT NULL,
        object_id TEXT NOT NULL,
        handle TEXT,
        title TEXT,
        body TEXT,
        url TEXT,
        embedding JSONB,
        synced_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE (shop_domain, content_type, object_id)
      )
    `);
    await c.query(`CREATE INDEX IF NOT EXISTS aisearch_content_v2_shop ON testing.aisearch_content_v2 (shop_domain)`);
    await c.query(`CREATE INDEX IF NOT EXISTS aisearch_content_v2_fts ON testing.aisearch_content_v2
      USING gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'')))`);

    await c.query(`
      CREATE TABLE IF NOT EXISTS testing.ai_search_data_v2 (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT now(),
        store_id TEXT,
        shop_domain TEXT,
        session_id TEXT,
        query TEXT,
        mode TEXT,
        intent JSONB,
        result_count INT DEFAULT 0,
        zero_result BOOLEAN DEFAULT false,
        latency_ms INT,
        meta JSONB
      )
    `);
    await c.query(`CREATE INDEX IF NOT EXISTS ai_search_data_v2_shop ON testing.ai_search_data_v2 (shop_domain, created_at)`);

    console.log("v2 tables created: aisearch_products_v2, aisearch_content_v2, ai_search_data_v2");
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
