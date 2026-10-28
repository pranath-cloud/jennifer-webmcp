export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  primaryHover: string;
  accentColor: string;
  backgroundColor: string;
  headerBackground: string;
  cardBackground: string;
  cardHoverBackground: string;
  textPrimary: string;
  textMuted: string;
  borderColor: string;
  borderRadius: string; // e.g. "14px", "8px", "0px"
  buttonRadius: string; // e.g. "6px", "9999px", "0px"
  fontFamily: string;
  shadowStyle: string;
  badgeStyle: "pill" | "rounded" | "minimal" | "dot";
  showInStockBadge: boolean;
  showColorBadges: boolean;
  showMaterialBadge: boolean;
  searchToggleText: string;
  searchToggleIcon: string;
  dropdownHeaderTitle: string;
  dropdownBadgeText: string;
  searchPlaceholder?: string;
  customCss?: string;
}

export interface PersonaConfig {
  greeting: string;
  starterChips: string[];
  tone: "luxury" | "friendly" | "modern" | "concise";
  voiceGender: "male" | "female";
  voiceRate: number;
}

export interface TenantConfig {
  id: string;
  shopDomain: string;
  brandName: string;
  shopifyAccessToken?: string;
  shopifyStoreDomain?: string;
  currency: string;
  discountCode: string;
  theme: ThemeConfig;
  persona: PersonaConfig;
  customSearchSelector?: string;
  customResultsGridSelector?: string;
  allowedOrigins?: string[];
  createdAt: string;
  updatedAt: string;
}