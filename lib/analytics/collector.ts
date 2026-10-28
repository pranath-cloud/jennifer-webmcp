import { TelemetryEvent, AnalyticsMetrics, SearchQueryStat } from "@/lib/types/analytics";
import { storage } from "@/lib/storage/store-adapter";
import { saveSearchQueryToPostgres, fetchSearchQueriesFromPostgres, SearchDataRecord } from "@/lib/db/postgres";

const TELEMETRY_STORAGE_KEY = "telemetry.json";

export async function recordTelemetryEvent(event: Omit<TelemetryEvent, "id" | "timestamp">): Promise<TelemetryEvent> {
  const fullEvent: TelemetryEvent = {
    ...event,
    id: "evt_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
    timestamp: new Date().toISOString(),
  };

  // 1. Persist search events to PostgreSQL database: testing.ai_search_data_v2
  if (event.eventType === "search_query" || event.eventType === "voice_search") {
    try {
      await saveSearchQueryToPostgres({
        shop_domain: event.shopDomain || "jenniferfurniturestaging.myshopify.com",
        query_text: event.queryText || "",
        interpreted_query: event.interpretedQuery || event.queryText || null,
        extracted_category: event.extractedConstraints?.category || null,
        extracted_color: event.extractedConstraints?.color || null,
        extracted_material: event.extractedConstraints?.material || null,
        extracted_features: [
          ...(event.extractedConstraints?.features || []),
          ...(event.extractedConstraints?.brand ? [`brand:${event.extractedConstraints.brand}`] : []),
        ],
        max_price: event.extractedConstraints?.max_price ?? null,
        min_price: event.extractedConstraints?.min_price ?? null,
        result_count: event.resultCount ?? 0,
        zero_result: event.zeroResult ?? (event.resultCount === 0),
        session_id: event.sessionId || null,
        mode: event.eventType,
      });
    } catch (err) {
      console.warn("Non-fatal Postgres search save error:", err);
    }
  }

  // 2. Cache locally in memory / file adapter
  try {
    const existing = storage.read<TelemetryEvent[]>(TELEMETRY_STORAGE_KEY, []);
    existing.unshift(fullEvent);
    const trimmed = existing.slice(0, 2000);
    storage.write(TELEMETRY_STORAGE_KEY, trimmed);
  } catch (e) {}

  return fullEvent;
}

function getLocalAnalytics(shopDomain?: string | null): AnalyticsMetrics {
  const events = storage.read<TelemetryEvent[]>(TELEMETRY_STORAGE_KEY, []);
  const cleanDomain = shopDomain ? shopDomain.toLowerCase().trim() : null;

  const filtered = cleanDomain
    ? events.filter((e) => e.shopDomain && e.shopDomain.toLowerCase().includes(cleanDomain))
    : events;

  const searchEvents = filtered.filter((e) => e.eventType === "search_query" || e.eventType === "voice_search");
  const totalSearches = searchEvents.length;
  const zeroResults = searchEvents.filter((e) => e.zeroResult || (typeof e.resultCount === "number" && e.resultCount === 0));
  const zeroResultRate = totalSearches > 0 ? Math.round((zeroResults.length / totalSearches) * 100) : 0;

  const queryMap = new Map<string, { count: number; totalResults: number; lastSearched: string; zeroResults: boolean; topCategory?: string; topColor?: string }>();
  const categoryMap = new Map<string, number>();
  const colorMap = new Map<string, number>();
  const materialMap = new Map<string, number>();

  searchEvents.forEach((e) => {
    const q = (e.queryText || "").trim().toLowerCase();
    if (!q) return;

    const count = (queryMap.get(q)?.count || 0) + 1;
    const totalResults = (queryMap.get(q)?.totalResults || 0) + (e.resultCount ?? 0);
    const isZero = e.resultCount === 0 || e.zeroResult === true;

    const cat = e.extractedConstraints?.category;
    const col = e.extractedConstraints?.color;
    const mat = e.extractedConstraints?.material;

    if (cat) categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    if (col) colorMap.set(col, (colorMap.get(col) || 0) + 1);
    if (mat) materialMap.set(mat, (materialMap.get(mat) || 0) + 1);

    queryMap.set(q, {
      count,
      totalResults,
      lastSearched: e.timestamp,
      zeroResults: isZero,
      topCategory: cat || queryMap.get(q)?.topCategory,
      topColor: col || queryMap.get(q)?.topColor,
    });
  });

  const topQueries: SearchQueryStat[] = Array.from(queryMap.entries())
    .map(([query, data]) => ({
      query,
      count: data.count,
      avgResults: Math.round(data.totalResults / data.count),
      zeroResults: data.zeroResults,
      topCategory: data.topCategory,
      topColor: data.topColor,
      lastSearched: data.lastSearched,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const unmetDemandQueries: SearchQueryStat[] = topQueries
    .filter((q) => q.avgResults === 0 || q.zeroResults)
    .slice(0, 10);

  const totalCatCount = Array.from(categoryMap.values()).reduce((a, b) => a + b, 0) || 1;
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, count]) => ({
      category: category.toUpperCase(),
      count,
      percentage: Math.round((count / totalCatCount) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const totalColorCount = Array.from(colorMap.values()).reduce((a, b) => a + b, 0) || 1;
  const colorBreakdown = Array.from(colorMap.entries())
    .map(([color, count]) => ({
      color: color.toUpperCase(),
      count,
      percentage: Math.round((count / totalColorCount) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const totalMatCount = Array.from(materialMap.values()).reduce((a, b) => a + b, 0) || 1;
  const materialBreakdown = Array.from(materialMap.entries())
    .map(([material, count]) => ({
      material: material.toUpperCase(),
      count,
      percentage: Math.round((count / totalMatCount) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    totalSearches,
    totalChats: 0,
    totalProductClicks: 0,
    zeroResultRate,
    voiceSearchRate: 0,
    topQueries,
    unmetDemandQueries,
    categoryBreakdown,
    colorBreakdown,
    materialBreakdown,
    recentSearches: filtered.slice(0, 20),
  };
}

export async function getAnalyticsForShop(shopDomain?: string | null): Promise<AnalyticsMetrics> {
  // Query PostgreSQL database testing.ai_search_data_v2 for persistent metrics
  try {
    const pgEvents = await fetchSearchQueriesFromPostgres(shopDomain, 500);
    if (pgEvents && pgEvents.length > 0) {
      const totalSearches = pgEvents.length;
      const zeroResults = pgEvents.filter((e) => e.zero_result || e.result_count === 0);
      const zeroResultRate = totalSearches > 0 ? Math.round((zeroResults.length / totalSearches) * 100) : 0;

      const queryMap = new Map<string, { count: number; totalResults: number; lastSearched: string; zeroResults: boolean; topCategory?: string; topColor?: string }>();
      const categoryMap = new Map<string, number>();
      const colorMap = new Map<string, number>();
      const materialMap = new Map<string, number>();

      pgEvents.forEach((e) => {
        const q = (e.query_text || "").trim().toLowerCase();
        if (!q) return;

        const count = (queryMap.get(q)?.count || 0) + 1;
        const totalResults = (queryMap.get(q)?.totalResults || 0) + (e.result_count ?? 0);
        const isZero = e.result_count === 0 || e.zero_result === true;

        const cat = e.extracted_category;
        const col = e.extracted_color;
        const mat = e.extracted_material;

        if (cat) categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
        if (col) colorMap.set(col, (colorMap.get(col) || 0) + 1);
        if (mat) materialMap.set(mat, (materialMap.get(mat) || 0) + 1);

        queryMap.set(q, {
          count,
          totalResults,
          lastSearched: e.created_at || new Date().toISOString(),
          zeroResults: isZero,
          topCategory: cat || queryMap.get(q)?.topCategory,
          topColor: col || queryMap.get(q)?.topColor,
        });
      });

      const topQueries: SearchQueryStat[] = Array.from(queryMap.entries())
        .map(([query, data]) => ({
          query,
          count: data.count,
          avgResults: Math.round(data.totalResults / data.count),
          zeroResults: data.zeroResults,
          topCategory: data.topCategory,
          topColor: data.topColor,
          lastSearched: data.lastSearched,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      const unmetDemandQueries: SearchQueryStat[] = topQueries
        .filter((q) => q.avgResults === 0 || q.zeroResults)
        .slice(0, 10);

      const totalCatCount = Array.from(categoryMap.values()).reduce((a, b) => a + b, 0) || 1;
      const categoryBreakdown = Array.from(categoryMap.entries())
        .map(([category, count]) => ({
          category: category.toUpperCase(),
          count,
          percentage: Math.round((count / totalCatCount) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      const totalColorCount = Array.from(colorMap.values()).reduce((a, b) => a + b, 0) || 1;
      const colorBreakdown = Array.from(colorMap.entries())
        .map(([color, count]) => ({
          color: color.toUpperCase(),
          count,
          percentage: Math.round((count / totalColorCount) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      const totalMatCount = Array.from(materialMap.values()).reduce((a, b) => a + b, 0) || 1;
      const materialBreakdown = Array.from(materialMap.entries())
        .map(([material, count]) => ({
          material: material.toUpperCase(),
          count,
          percentage: Math.round((count / totalMatCount) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      return {
        totalSearches,
        totalChats: 0,
        totalProductClicks: 0,
        zeroResultRate,
        voiceSearchRate: 0,
        topQueries,
        unmetDemandQueries,
        categoryBreakdown,
        colorBreakdown,
        materialBreakdown,
        recentSearches: pgEvents.slice(0, 20).map((e) => ({
          id: "pg_" + e.id,
          timestamp: e.created_at || new Date().toISOString(),
          eventType: "search_query" as const,
          queryText: e.query_text,
          interpretedQuery: e.interpreted_query || undefined,
          extractedConstraints: {
            category: e.extracted_category || undefined,
            color: e.extracted_color || undefined,
            material: e.extracted_material || undefined,
            max_price: e.max_price ?? undefined,
          },
          resultCount: e.result_count,
          zeroResult: e.zero_result,
          shopDomain: e.shop_domain,
        })),
      };
    }
  } catch (err) {
    console.warn("Postgres analytics read error, falling back to local:", err);
  }

  return getLocalAnalytics(shopDomain);
}