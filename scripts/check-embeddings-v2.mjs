import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const kv = Object.fromEntries(env.split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const shop = process.argv[2] || 'jennifurniture.myshopify.com';

const c = new pg.Client({ host: kv.PG_HOST, port: +kv.PG_PORT, user: kv.PG_USER, password: kv.PG_PASSWORD, database: kv.PG_DATABASE });
await c.connect();
const r = await c.query(
  `SELECT title, embedding IS NOT NULL tv, image_embedding IS NOT NULL iv
   FROM testing.aisearch_products_v2 WHERE shop_domain=$1`, [shop]);
const tv = r.rows.filter(x => x.tv).length, iv = r.rows.filter(x => x.iv).length;
console.log(`products: ${r.rows.length} | text vecs: ${tv} | image vecs: ${iv}`);
const miss = r.rows.filter(x => !x.iv).map(x => x.title);
console.log(`missing image vec (${miss.length}):`, miss.slice(0, 20).join(' | '));
const v = r.rows.find(x => x.title.toLowerCase().includes('vilander'));
console.log('vilander:', JSON.stringify(v));
await c.end();
