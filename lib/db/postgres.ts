import { Pool } from "pg";

// Host/port/db/user are infrastructure coordinates, not secrets — defaults OK.
// PG_PASSWORD must come from the environment (Vercel env / AWS Secrets Manager).
const PG_HOST = process.env.PG_HOST || "44.194.110.48";
const PG_PORT = parseInt(process.env.PG_PORT || "5000", 10);
const PG_DATABASE = process.env.PG_DATABASE || "nifi_poc";
const PG_USER = process.env.PG_USER || "utkarsh";
const PG_PASSWORD = process.env.PG_PASSWORD;

// Global pool instance to prevent connection exhaustion in serverless environments
let pool: Pool | null = null;

export function getPgPool(): Pool {
  if (!PG_PASSWORD) {
    throw new Error("PG_PASSWORD env var is not set — required for Postgres access");
  }
  if (!pool) {
    pool = new Pool({
      host: PG_HOST,
      port: PG_PORT,
      database: PG_DATABASE,
      user: PG_USER,
      password: PG_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: false,
    });

    pool.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL client:", err);
    });
  }
  return pool;
}

export interface SearchDataRecord {
  id?: number;
  shop_domain: string;
  query_text: string;
  interpreted_query?: string | null;
  extracted_category?: string | null;
  extracted_color?: string | null;
  extracted_material?: string | null;
  extracted_features?: string[];
  max_price?: number | null;
  min_price?: number | null;
  result_count?: number;
  zero_result?: boolean;
  session_id?: string | null;
  mode?: string;
  latency_ms?: number | null;
  created_at?: string;
}

// In-memory cache for recent search deduplication (key: shop_domain+session_id+query_text, value: timestamp)
const recentInsertCache = new Map<string, number>();

/**
 * Save a search query event into PostgreSQL testing.ai_search_data_v2
 */
export async function saveSearchQueryToPostgres(record: SearchDataRecord): Promise<number | null> {
  const cleanQuery = (record.query_text || "").trim();
  
  // Guard 1: Reject empty or trivial incomplete strings (< 3 characters)
  if (cleanQuery.length < 3) {
    return null;
  }

  // Guard 2: Deduplicate identical submissions from same session within 15 seconds
  const dedupKey = `${(record.shop_domain || "").toLowerCase()}:${record.session_id || "anon"}:${cleanQuery.toLowerCase()}`;
  const now = Date.now();
  const lastTime = recentInsertCache.get(dedupKey);
  if (lastTime && now - lastTime < 15000) {
    // Duplicate search within 15s window, skip insert
    return null;
  }
  recentInsertCache.set(dedupKey, now);

  // Prune cache if it exceeds 1000 items
  if (recentInsertCache.size > 1000) {
    for (const [k, t] of recentInsertCache.entries()) {
      if (now - t > 60000) recentInsertCache.delete(k);
    }
  }

  try {
    const p = getPgPool();
    const query = `
      INSERT INTO testing.ai_search_data_v2 (
        shop_domain,
        store_id,
        query,
        mode,
        intent,
        result_count,
        zero_result,
        latency_ms,
        session_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id;
    `;

    const intent = {
      interpreted_query: record.interpreted_query || null,
      category: record.extracted_category || null,
      color: record.extracted_color || null,
      material: record.extracted_material || null,
      features: record.extracted_features || [],
      max_price: record.max_price ?? null,
      min_price: record.min_price ?? null,
    };

    const values = [
      record.shop_domain,
      record.shop_domain,
      record.query_text,
      record.mode || "search_query",
      JSON.stringify(intent),
      record.result_count ?? 0,
      record.zero_result ?? false,
      record.latency_ms ?? null,
      record.session_id || null,
    ];

    const result = await p.query(query, values);
    return result.rows[0]?.id || null;
  } catch (error) {
    console.error("Error saving search data to PostgreSQL testing.ai_search_data_v2:", error);
    return null;
  }
}

/**
 * Fetch recent search queries per store from PostgreSQL testing.ai_search_data_v2
 */
export async function fetchSearchQueriesFromPostgres(shopDomain?: string | null, limit: number = 50): Promise<SearchDataRecord[]> {
  try {
    const p = getPgPool();
    let query = `
      SELECT
        id,
        shop_domain,
        query AS query_text,
        intent->>'interpreted_query' AS interpreted_query,
        intent->>'category' AS extracted_category,
        intent->>'color' AS extracted_color,
        intent->>'material' AS extracted_material,
        COALESCE(intent->'features', '[]'::jsonb) AS extracted_features,
        (intent->>'max_price')::float AS max_price,
        (intent->>'min_price')::float AS min_price,
        result_count,
        zero_result,
        session_id,
        created_at
      FROM testing.ai_search_data_v2
    `;

    const values: any[] = [];
    if (shopDomain) {
      query += ` WHERE LOWER(shop_domain) LIKE $1`;
      values.push(`%${shopDomain.toLowerCase().trim()}%`);
      query += ` ORDER BY id DESC LIMIT $2`;
      values.push(limit);
    } else {
      query += ` ORDER BY id DESC LIMIT $1`;
      values.push(limit);
    }

    const result = await p.query(query, values);
    return result.rows.map((row) => ({
      id: row.id,
      shop_domain: row.shop_domain,
      query_text: row.query_text,
      interpreted_query: row.interpreted_query,
      extracted_category: row.extracted_category,
      extracted_color: row.extracted_color,
      extracted_material: row.extracted_material,
      extracted_features: row.extracted_features || [],
      max_price: row.max_price ? parseFloat(row.max_price) : null,
      min_price: row.min_price ? parseFloat(row.min_price) : null,
      result_count: row.result_count,
      zero_result: row.zero_result,
      session_id: row.session_id,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    }));
  } catch (error) {
    console.error("Error fetching search queries from PostgreSQL:", error);
    return [];
  }
}
