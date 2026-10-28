export interface TelemetryEvent {
  id?: string;
  shopDomain: string;
  eventType: "search_query" | "autocomplete_click" | "concierge_chat" | "product_view" | "checkout_intent" | "voice_search";
  queryText?: string;
  interpretedQuery?: string;
  extractedConstraints?: {
    category?: string;
    features?: string[];
    color?: string;
    material?: string;
    brand?: string;
    min_price?: number;
    max_price?: number;
  };
  resultCount?: number;
  zeroResult?: boolean;
  clickedProductId?: string;
  clickedProductTitle?: string;
  sessionId?: string;
  timestamp: string;
}

export interface SearchQueryStat {
  query: string;
  count: number;
  avgResults: number;
  zeroResults: boolean;
  topCategory?: string;
  topColor?: string;
  lastSearched: string;
}

export interface AnalyticsMetrics {
  totalSearches: number;
  totalChats: number;
  totalProductClicks: number;
  zeroResultRate: number;
  voiceSearchRate: number;
  topQueries: SearchQueryStat[];
  unmetDemandQueries: SearchQueryStat[];
  categoryBreakdown: { category: string; count: number; percentage: number }[];
  colorBreakdown: { color: string; count: number; percentage: number }[];
  materialBreakdown: { material: string; count: number; percentage: number }[];
  recentSearches: TelemetryEvent[];
}