/**
 * Register product webhooks for a shop → keeps the v2 index + embeddings live.
 *
 *   node scripts/register-webhooks-v2.mjs <shop_domain> [custom_app_secret]
 *
 * <shop_domain>:       e.g. jennifurniture.myshopify.com
 * [custom_app_secret]: client secret of the custom app whose shpat_ token we
 *                      hold — Shopify signs webhooks with the SUBSCRIBING app's
 *                      secret. Stored in aisearch_shops.settings.webhook_secret
 *                      so the route can verify HMAC against it.
 */
import pg from "pg";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SHOP = process.argv[2];
const APP_SECRET = process.argv[3] || null;
const CALLBACK = "https://webmcp.tendrilsioservices.com/api/webhooks/shopify";
const TOPICS = ["PRODUCTS_CREATE", "PRODUCTS_UPDATE", "PRODUCTS_DELETE"];
if (!SHOP) { console.error("usage: node scripts/register-webhooks-v2.mjs <shop> [custom_app_secret]"); process.exit(1); }

const pool = new pg.Pool({
  host: env.PG_HOST, port: parseInt(env.PG_PORT || "5000"),
  database: env.PG_DATABASE, user: env.PG_USER, password: env.PG_PASSWORD, max: 2,
});

const { rows } = await pool.query(
  `SELECT access_token FROM testing.aisearch_shops WHERE shop_domain=$1 AND uninstalled_at IS NULL`, [SHOP]);
const token = rows[0]?.access_token;
if (!token) { console.error(`no active token for ${SHOP}`); process.exit(1); }

async function gql(query, variables = {}) {
  const res = await fetch(`https://${SHOP}/admin/api/2025-01/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

// Existing subscriptions — skip topics already pointing at our endpoint
const existing = await gql(`{
  webhookSubscriptions(first: 50) {
    edges { node { id topic endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } } } }
  }
}`);
const subs = existing.data?.webhookSubscriptions?.edges?.map((e) => e.node) || [];
console.log(`existing subscriptions on ${SHOP}: ${subs.length}`);
for (const s of subs) console.log(`  ${s.topic} → ${s.endpoint?.callbackUrl || s.endpoint?.__typename}`);

for (const topic of TOPICS) {
  const dup = subs.find((s) => s.topic === topic && s.endpoint?.callbackUrl === CALLBACK);
  if (dup) { console.log(`= ${topic}: already registered`); continue; }
  const r = await gql(
    `mutation Hook($topic: WebhookSubscriptionTopic!, $cb: URL!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: { callbackUrl: $cb, format: JSON }) {
        webhookSubscription { id topic }
        userErrors { field message }
      }
    }`, { topic, cb: CALLBACK });
  const errs = r.data?.webhookSubscriptionCreate?.userErrors || [];
  if (errs.length) console.log(`✗ ${topic}: ${errs.map((e) => e.message).join(", ")}`);
  else console.log(`✓ ${topic}: ${r.data.webhookSubscriptionCreate.webhookSubscription.id}`);
}

// Save the custom-app secret for webhook HMAC verification, if provided
if (APP_SECRET) {
  await pool.query(
    `UPDATE testing.aisearch_shops
       SET settings = COALESCE(settings,'{}'::jsonb) || jsonb_build_object('webhook_secret',$2::text), updated_at=now()
     WHERE shop_domain=$1`, [SHOP, APP_SECRET]);
  console.log(`✓ stored webhook_secret in settings for ${SHOP}`);
} else {
  console.log(`\nNOTE: no custom_app_secret passed — product webhooks will be signed by the`);
  console.log(`custom app that owns this shpat_ token, NOT SHOPIFY_API_SECRET. If HMAC 401s,`);
  console.log(`re-run with the app's client secret: Shopify admin → Develop apps → app → API credentials → "API secret key".`);
}

await pool.end();
