import { TenantConfig } from "@/lib/types/tenant";
import { THEME_PRESETS } from "@/lib/tenants/presets";
import { storage } from "@/lib/storage/store-adapter";

const STORES_STORAGE_KEY = "stores.json";

export const DEFAULT_STORE: TenantConfig = {
  id: "jennifer-furniture",
  shopDomain: "jenniferfurniturestaging.myshopify.com",
  brandName: "Jennifer Furniture",
  shopifyStoreDomain: "jenniferfurniturestaging.myshopify.com",
  currency: "USD",
  discountCode: "WEBMCP10",
  theme: THEME_PRESETS["luxury-minimalist"],
  persona: {
    greeting: "Welcome to Jennifer Furniture. I am your personal spatial and furniture design consultant. How can I assist you with your space today?",
    starterChips: [
      "In-Stock Sofas & Sectionals",
      "Brown Leather Gliding Recliners",
      "Check 15x12 Room Fit",
      "Curated 3-Piece Suites"
    ],
    tone: "luxury",
    voiceGender: "male",
    voiceRate: 0.98,
  },
  customSearchSelector: 'form[action*="/search"] input[name="q"], form.search input[name="q"], #Search-In-Modal, .search__input',
  customResultsGridSelector: '#product-grid, .template-search__results, #main-search-results, .product-grid, .search__results',
  allowedOrigins: ["*"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: new Date().toISOString(),
};

export const COMFORT_FURNITURE_STORE: TenantConfig = {
  id: "comfort-furniture",
  shopDomain: "jennifercomfortfurniture.myshopify.com",
  brandName: "Comfort Design Furniture",
  shopifyStoreDomain: "jennifercomfortfurniture.myshopify.com",
  currency: "USD",
  discountCode: "COMFORT10",
  theme: THEME_PRESETS["warm-artisan"] || THEME_PRESETS["luxury-minimalist"],
  persona: {
    greeting: "Welcome to Comfort Design Furniture. How can I assist you with finding cozy, in-stock furniture today?",
    starterChips: ["Plush Sofas", "Ergonomic Recliners", "Sectionals Under $2,000", "Dining Sets"],
    tone: "friendly",
    voiceGender: "male",
    voiceRate: 0.98,
  },
  customSearchSelector: 'form[action*="/search"] input[name="q"], form.search input[name="q"], #Search-In-Modal, .search__input',
  customResultsGridSelector: '#product-grid, .template-search__results, #main-search-results, .product-grid, .search__results',
  allowedOrigins: ["*"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: new Date().toISOString(),
};

export const SOFABED_STORE: TenantConfig = {
  id: "sofabed",
  shopDomain: "onlinesalesonly.myshopify.com",
  brandName: "SofaBed",
  shopifyStoreDomain: "onlinesalesonly.myshopify.com",
  currency: "USD",
  discountCode: "SOFABED10",
  theme: THEME_PRESETS["luxury-minimalist"],
  persona: {
    greeting: "Welcome to SofaBed. How can I help you find the ideal convertible sleeper or sectional today?",
    starterChips: ["Sleeper Sofas", "Sectionals with Bed", "Queen Sleepers", "Compact Loveseat Beds"],
    tone: "luxury",
    voiceGender: "male",
    voiceRate: 0.98,
  },
  customSearchSelector: 'form[action*="/search"] input[name="q"], form.search input[name="q"], #Search-In-Modal, .search__input',
  customResultsGridSelector: '#product-grid, .template-search__results, #main-search-results, .product-grid, .search__results',
  allowedOrigins: ["*"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: new Date().toISOString(),
};

export const JENNIHOME_STORE: TenantConfig = {
  id: "jennihome",
  shopDomain: "jennifurniture.myshopify.com",
  brandName: "JenniHome",
  shopifyStoreDomain: "jennifurniture.myshopify.com",
  currency: "USD",
  discountCode: "JENNI10",
  theme: THEME_PRESETS["warm-artisan"] || THEME_PRESETS["luxury-minimalist"],
  persona: {
    greeting: "Welcome to JenniHome. Looking for curated home decor, living room suites, or bedroom sets?",
    starterChips: ["Living Room Sets", "Modern Bedrooms", "Dining Tables", "Accent Chairs"],
    tone: "luxury",
    voiceGender: "male",
    voiceRate: 0.98,
  },
  customSearchSelector: 'form[action*="/search"] input[name="q"], form.search input[name="q"], #Search-In-Modal, .search__input',
  customResultsGridSelector: '#product-grid, .template-search__results, #main-search-results, .product-grid, .search__results',
  allowedOrigins: ["*"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: new Date().toISOString(),
};

export const JENNIFER_CONVERTIBLES_STORE: TenantConfig = {
  id: "jennifer-convertibles",
  shopDomain: "jennifer-convertibles.myshopify.com",
  brandName: "Jennifer Furniture",
  shopifyStoreDomain: "jennifer-convertibles.myshopify.com",
  currency: "USD",
  discountCode: "JENNIFER10",
  theme: THEME_PRESETS["luxury-minimalist"],
  persona: {
    greeting: "Welcome to Jennifer Furniture. How can I assist you with finding luxury living and dining room pieces?",
    starterChips: ["Power Reclining Sofas", "Leather Sectionals", "Bedroom Sets", "Dining Collections"],
    tone: "luxury",
    voiceGender: "male",
    voiceRate: 0.98,
  },
  customSearchSelector: 'form[action*="/search"] input[name="q"], form.search input[name="q"], #Search-In-Modal, .search__input',
  customResultsGridSelector: '#product-grid, .template-search__results, #main-search-results, .product-grid, .search__results',
  allowedOrigins: ["*"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: new Date().toISOString(),
};

export const ALL_INITIAL_STORES: TenantConfig[] = [
  DEFAULT_STORE,
  COMFORT_FURNITURE_STORE,
  SOFABED_STORE,
  JENNIHOME_STORE,
  JENNIFER_CONVERTIBLES_STORE,
];

export function getAllStores(): TenantConfig[] {
  const stores = storage.read<TenantConfig[]>(STORES_STORAGE_KEY, ALL_INITIAL_STORES);
  ALL_INITIAL_STORES.forEach(initStore => {
    if (!stores.some(s => s.shopDomain === initStore.shopDomain)) {
      stores.push(initStore);
    }
  });
  return stores;
}

export function getStoreByDomain(domain?: string | null): TenantConfig {
  if (!domain) return DEFAULT_STORE;
  const clean = domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const stores = getAllStores();
  
  // 1. Exact match on shopDomain or ID
  const exact = stores.find(s => s.shopDomain.toLowerCase() === clean || s.id.toLowerCase() === clean);
  if (exact) return exact;

  // 2. Target domain keyword matches
  if (clean.includes("onlinesalesonly") || clean.includes("sofabed")) {
    const found = stores.find(s => s.id === "sofabed" || s.shopDomain.includes("onlinesalesonly"));
    if (found) return found;
  }

  if (clean.includes("jennifurniture") || clean.includes("jennihome")) {
    const found = stores.find(s => s.id === "jennihome" || s.shopDomain.includes("jennifurniture"));
    if (found) return found;
  }

  if (clean.includes("convertibles") || clean.includes("jenniferfurniture.com")) {
    const found = stores.find(s => s.id === "jennifer-convertibles" || s.shopDomain.includes("jennifer-convertibles"));
    if (found) return found;
  }

  if (clean.includes("comfort")) {
    const comfort = stores.find(s => s.id === "comfort-furniture" || s.shopDomain.includes("comfort"));
    if (comfort) return comfort;
  }

  if (clean.includes("staging") || clean.includes("jenniferfurniturestaging") || clean.includes("jfstaging")) {
    const staging = stores.find(s => s.id === "jennifer-furniture" || s.shopDomain.includes("staging"));
    if (staging) return staging;
  }

  return DEFAULT_STORE;
}

export function getStoreById(id: string): TenantConfig | null {
  const stores = getAllStores();
  return stores.find(s => s.id === id) || null;
}

export function saveStore(store: TenantConfig): TenantConfig {
  const stores = getAllStores();
  const idx = stores.findIndex(s => s.id === store.id || s.shopDomain === store.shopDomain);
  const now = new Date().toISOString();
  const updated = { ...store, updatedAt: now };

  if (idx >= 0) {
    stores[idx] = updated;
  } else {
    stores.push({ ...updated, createdAt: now });
  }

  storage.write(STORES_STORAGE_KEY, stores);
  return updated;
}

export function deleteStore(id: string): boolean {
  if (id === DEFAULT_STORE.id) return false; // Prevent deleting default store
  const stores = getAllStores();
  const filtered = stores.filter(s => s.id !== id);
  storage.write(STORES_STORAGE_KEY, filtered);
  return true;
}

/** GDPR purge — drop any stores.json overlay saved for this shop domain.
 *  Built-in presets re-materialize from code via getAllStores(), which is
 *  fine: presets contain no shop-specific data. */
export function removeStoreByDomain(shopDomain: string): boolean {
  const clean = shopDomain.toLowerCase().trim();
  const stores = getAllStores();
  const filtered = stores.filter(s => s.shopDomain.toLowerCase() !== clean);
  if (filtered.length === stores.length) return false;
  storage.write(STORES_STORAGE_KEY, filtered);
  return true;
}