// Seeds testing.aisearch_shops with the existing per-store custom-app tokens
// (the shpat_* values already live in lib/shopify/client.ts STORE_REGISTRY).
// These stores already have the app installed — this just moves their tokens
// into the DB so token resolution is DB-first. New stores go through /api/auth.
// Run: node scripts/seed-legacy-shop-tokens.mjs
// Tokens come from a gitignored JSON file — never committed.
// Format: [["<shop>.myshopify.com", "shpat_..."], ...]
// Point TOKENS_FILE at it: TOKENS_FILE=./legacy-tokens.json node scripts/seed-legacy-shop-tokens.mjs
import pg from "pg";
import { readFileSync } from "fs";

if (!process.env.PG_PASSWORD || !process.env.TOKENS_FILE) {
  console.error("PG_PASSWORD and TOKENS_FILE env vars required");
  process.exit(1);
}

const LEGACY_TOKENS = JSON.parse(readFileSync(process.env.TOKENS_FILE, "utf8"));

const pool = new pg.Pool({
  host: process.env.PG_HOST || "44.194.110.48",
  port: parseInt(process.env.PG_PORT || "5000", 10),
  database: process.env.PG_DATABASE || "nifi_poc",
  user: process.env.PG_USER || "utkarsh",
  password: process.env.PG_PASSWORD,
  connectionTimeoutMillis: 5000,
  ssl: false,
});

try {
  for (const [domain, token] of LEGACY_TOKENS) {
    await pool.query(
      `INSERT INTO testing.aisearch_shops (shop_domain, access_token, scope, settings)
       VALUES ($1, $2, 'custom_app', $3)
       ON CONFLICT (shop_domain) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         uninstalled_at = NULL,
         updated_at = now()`,
      [domain, token, JSON.stringify({ source: "legacy_token_seed" })]
    );
    console.log("seeded", domain);
  }
  const r = await pool.query(
    "SELECT shop_domain, scope, uninstalled_at IS NULL AS active FROM testing.aisearch_shops ORDER BY shop_domain"
  );
  console.table(r.rows);
} catch (e) {
  console.error("ERR", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
