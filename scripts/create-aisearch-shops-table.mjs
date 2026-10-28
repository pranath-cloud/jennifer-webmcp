// One-time migration: creates testing.aisearch_shops in nifi_poc.
// Run: node scripts/create-aisearch-shops-table.mjs
import pg from "pg";

if (!process.env.PG_PASSWORD) {
  console.error("PG_PASSWORD env var required");
  process.exit(1);
}

const pool = new pg.Pool({
  host: process.env.PG_HOST || "44.194.110.48",
  port: parseInt(process.env.PG_PORT || "5000", 10),
  database: process.env.PG_DATABASE || "nifi_poc",
  user: process.env.PG_USER || "utkarsh",
  password: process.env.PG_PASSWORD,
  connectionTimeoutMillis: 5000,
  ssl: false,
});

const ddl = `
CREATE TABLE IF NOT EXISTS testing.aisearch_shops (
  id             BIGSERIAL PRIMARY KEY,
  shop_domain    TEXT NOT NULL UNIQUE,
  access_token   TEXT NOT NULL,
  scope          TEXT,
  settings       JSONB NOT NULL DEFAULT '{}'::jsonb,
  installed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  uninstalled_at TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aisearch_shops_domain_idx
  ON testing.aisearch_shops (lower(shop_domain));
`;

try {
  await pool.query(ddl);
  const check = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='testing' AND table_name='aisearch_shops' ORDER BY ordinal_position"
  );
  console.log("OK — columns:", check.rows.map(r => r.column_name).join(", "));
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
