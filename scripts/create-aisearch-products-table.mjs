/**
 * Creates testing.aisearch_products — the per-shop catalog index that makes
 * search hit Postgres (~30-80ms) instead of a live Shopify GraphQL roundtrip
 * (~600ms+ cold). tsvector full-text search is built into Postgres (no
 * extension needed); pg_trgm is enabled opportunistically for typo tolerance.
 *
 *   node scripts/create-aisearch-products-table.mjs
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

const pool = new pg.Pool({
  host: env.PG_HOST, port: +(env.PG_PORT || 5432), database: env.PG_DATABASE,
  user: env.PG_USER, password: env.PG_PASSWORD, ssl: { rejectUnauthorized: false },
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS testing.aisearch_products (
    id               bigint generated always as identity PRIMARY KEY,
    shop_domain      text NOT NULL,
    product_id       text NOT NULL,
    handle           text NOT NULL,
    title            text NOT NULL,
    vendor           text,
    product_type     text,
    tags             jsonb DEFAULT '[]',
    sku_list         jsonb DEFAULT '[]',
    min_price        numeric,
    max_price        numeric,
    total_inventory  integer DEFAULT 0,
    status           text DEFAULT 'active',
    summary          jsonb NOT NULL,
    search_text      text,
    synced_at        timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now(),
    UNIQUE (shop_domain, product_id)
  )
`);
console.log("table ok");

await pool.query(`CREATE INDEX IF NOT EXISTS aisearch_products_shop_idx ON testing.aisearch_products (shop_domain)`);
await pool.query(`CREATE INDEX IF NOT EXISTS aisearch_products_tsv_idx ON testing.aisearch_products USING gin (
  to_tsvector('english',
    coalesce(title,'') || ' ' || coalesce(vendor,'') || ' ' ||
    coalesce(product_type,'') || ' ' || coalesce(search_text,'')))`);
await pool.query(`CREATE INDEX IF NOT EXISTS aisearch_products_price_idx ON testing.aisearch_products (shop_domain, min_price)`);
console.log("indexes ok");

// Typo tolerance — only if we can enable pg_trgm (needs CREATE EXTENSION privs)
try {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  await pool.query(`CREATE INDEX IF NOT EXISTS aisearch_products_trgm_idx ON testing.aisearch_products USING gin ((coalesce(title,'') || ' ' || coalesce(search_text,'')) gin_trgm_ops)`);
  console.log("pg_trgm enabled + index built");
} catch (e) {
  console.log("pg_trgm unavailable (no privilege) — tsvector only:", e.message.slice(0, 100));
}

// Content index — pages, articles, collections (the "whole website" for RAG)
await pool.query(`
  CREATE TABLE IF NOT EXISTS testing.aisearch_content (
    id           bigint generated always as identity PRIMARY KEY,
    shop_domain  text NOT NULL,
    content_type text NOT NULL,
    object_id    text NOT NULL,
    handle       text,
    title        text NOT NULL,
    body         text,
    url          text,
    author       text,
    synced_at    timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now(),
    UNIQUE (shop_domain, content_type, object_id)
  )
`);
await pool.query(`CREATE INDEX IF NOT EXISTS aisearch_content_shop_idx ON testing.aisearch_content (shop_domain)`);
await pool.query(`CREATE INDEX IF NOT EXISTS aisearch_content_tsv_idx ON testing.aisearch_content USING gin (
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'')))`);
console.log("content table ok");

await pool.end();
console.log("done");
