// Touch a product (no-op title rewrite) to fire a real products/update webhook.
import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const kv = Object.fromEntries(env.split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const SHOP = 'jennifurniture.myshopify.com';

const c = new pg.Client({ host: kv.PG_HOST, port: +kv.PG_PORT, user: kv.PG_USER, password: kv.PG_PASSWORD, database: kv.PG_DATABASE });
await c.connect();
const t = (await c.query(`SELECT access_token FROM testing.aisearch_shops WHERE shop_domain=$1`, [SHOP])).rows[0].access_token;
const p = (await c.query(`SELECT product_id, title FROM testing.aisearch_products_v2 WHERE shop_domain=$1 AND status='active' ORDER BY updated_at DESC LIMIT 1`, [SHOP])).rows[0];
console.log('firing products/update on:', p.title.slice(0, 70));

const r = await fetch(`https://${SHOP}/admin/api/2025-01/graphql.json`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': t },
  body: JSON.stringify({
    query: 'mutation noop($id: ID!, $title: String!) { productUpdate(input: {id: $id, title: $title}) { product { id } userErrors { message } } }',
    variables: { id: p.product_id, title: p.title },
  }),
});
const j = await r.json();
console.log('update:', JSON.stringify(j.data?.productUpdate?.userErrors?.length ? j.data.productUpdate.userErrors : 'ok — webhook should fire in ~2s'));
await c.end();
