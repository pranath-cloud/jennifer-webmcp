export type ImageRole =
  | "canonical_product_view"
  | "product_angle"
  | "lifestyle_room_view"
  | "fabric_swatch"
  | "dimension_diagram";

export interface ProductVisualAsset {
  url: string;
  imageBase64?: string; // data:image/jpeg;base64,...
  imageRole: ImageRole;
  altText?: string | null;
  geometryPreservationPrompt?: string;
}

export interface ProductVariant {
  id: string;
  title: string;
  sku: string;
  price: string;
  compareAtPrice?: string | null;
  availableForSale: boolean;
  inventoryQuantity: number;
  inStock: boolean;
  stockStatus: "PHYSICAL_STOCK_VERIFIED" | "ZERO_STOCK_UNAVAILABLE" | "BACKORDER_PERMITTED";
  selectedOptions: {
    name: string;
    value: string;
  }[];
  image?: {
    url: string;
    altText?: string | null;
  } | null;
}

export interface ProductOption {
  id?: string;
  name: string;
  values: string[];
}

export interface ProductMetafield {
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface ProductSummary {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  minPrice: number;
  maxPrice: number;
  currency: string;
  inStock: boolean;
  totalInventory: number;
  featuredImage?: string | null;
  availableColors: string[];
  availableSizes: string[];
  tags: string[];
  matchedVariantId?: string;
}

export interface ProductDetailed extends ProductSummary {
  description: string;
  specifications: {
    dimensions?: string | null;
    materials?: string | null;
    fabricDetails?: string | null;
    careInstructions?: string | null;
    warranty?: string | null;
    ratingCount?: number | null;
  };
  options: ProductOption[];
  variants: ProductVariant[];
  images: {
    url: string;
    altText?: string | null;
  }[];
}

export interface ProductComparisonMatrix {
  products: {
    id: string;
    title: string;
    handle: string;
    vendor: string;
    price: number;
    compareAtPrice?: number | null;
    inStock: boolean;
    totalInventory: number;
    featuredImage?: string | null;
    dimensions: string;
    material: string;
    keyHighlights: string[];
    pros: string[];
    cons: string[];
  }[];
  summaryRecommendation: string;
  bestValueId: string;
  mostPremiumId: string;
}

export interface VariantCheckResult {
  productId: string;
  productTitle: string;
  requestedOptions: Record<string, string>;
  isAvailable: boolean;
  matchedVariant?: {
    id: string;
    title: string;
    sku: string;
    price: number;
    inventoryQuantity: number;
    availableForSale: boolean;
  } | null;
  allVariantsInStock: {
    id: string;
    title: string;
    price: number;
    inventoryQuantity: number;
  }[];
  message: string;
}

export interface CheckoutHandoffResult {
  checkoutUrl: string;
  shopDomain: string;
  lineItems: {
    variantId: string;
    variantNumericId: string;
    title: string;
    quantity: number;
    price: number;
  }[];
  estimatedTotal: number;
  discountCodeApplied?: string | null;
  expiresIn: string;
}

export interface AgentTelemetryEvent {
  id: string;
  timestamp: string;
  toolName: string;
  inputs: Record<string, unknown>;
  latencyMs: number;
  status: "executing" | "success" | "error";
  summary: string;
  responsePreview?: unknown;
  role?: "customer" | "admin";
}

// Enterprise Store Owner BI Types
export interface StoreRevenueMetrics {
  timeframe: string;
  currency: string;
  estimatedTotalRevenue: number;
  totalOrdersEstimate: number;
  averageOrderValue: number;
  topSellingCategories: {
    category: string;
    revenue: number;
    sharePercent: number;
  }[];
  webmcpAttributedRevenue: number;
  webmcpConversionRate: number;
  executiveSummary: string;
}

export interface InventoryHealthAlert {
  productId: string;
  title: string;
  vendor: string;
  productType: string;
  totalInventory: number;
  status: "critical_stockout" | "low_stock" | "healthy";
  variantsAtRisk: {
    variantId: string;
    title: string;
    inventoryQuantity: number;
  }[];
  recommendedReorderQty: number;
}

export interface CustomerSearchTrend {
  keyword: string;
  searchVolume: number;
  conversionRate: number;
  stockAvailabilityRate: number;
}
