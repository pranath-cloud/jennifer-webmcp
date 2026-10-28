import { ProductSummary } from "./types/shopify";

export interface UserSessionContext {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  roomDimensions?: {
    width_feet?: number;
    length_feet?: number;
    width_cm?: number;
    length_cm?: number;
    raw?: string;
  };
  budget?: {
    max_price?: number;
    min_price?: number;
    currency?: string;
    raw?: string;
  };
  preferredColors: string[];
  preferredMaterials: string[];
  category?: string;
  lastViewedProducts: Array<{
    id: string;
    title: string;
    handle: string;
    price: number;
    variantId: string;
  }>;
  activeProductInFocus?: {
    id: string;
    title: string;
    handle: string;
    price: number;
    variantId: string;
  };
  lastToolExecuted?: string;
  lastFitScorecard?: any;
  lastFloorplan?: any;
  lastBundle?: any;
  history: Array<{ role: string; content: string }>;
}

const sessionStore = new Map<string, UserSessionContext>();

// Cleanup stale sessions older than 24 hours
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;
    for (const [sId, ctx] of sessionStore.entries()) {
      if (now - ctx.updatedAt > maxAge) {
        sessionStore.delete(sId);
      }
    }
  }, 30 * 60 * 1000);
}

export function getSessionContext(sessionId: string): UserSessionContext {
  if (!sessionStore.has(sessionId)) {
    sessionStore.set(sessionId, {
      sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      preferredColors: [],
      preferredMaterials: [],
      lastViewedProducts: [],
      history: [],
    });
  }
  const ctx = sessionStore.get(sessionId)!;
  ctx.updatedAt = Date.now();
  return ctx;
}

export function updateSessionContext(
  sessionId: string,
  updates: Partial<UserSessionContext>
): UserSessionContext {
  const ctx = getSessionContext(sessionId);
  Object.assign(ctx, updates, { updatedAt: Date.now() });
  return ctx;
}

export function extractAndCacheContextFromQuery(sessionId: string, query: string): UserSessionContext {
  const ctx = getSessionContext(sessionId);
  const text = query.toLowerCase();

  // 1. Extract Room Dimensions
  const cmMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:cm|centimeters?)\s*(?:x|into|by|\*)\s*(\d+(?:\.\d+)?)\s*(?:cm|centimeters?)/i);
  if (cmMatch) {
    const wCm = parseFloat(cmMatch[1]);
    const lCm = parseFloat(cmMatch[2]);
    ctx.roomDimensions = {
      width_cm: wCm,
      length_cm: lCm,
      width_feet: Math.round((wCm / 30.48) * 10) / 10,
      length_feet: Math.round((lCm / 30.48) * 10) / 10,
      raw: `${wCm}cm x ${lCm}cm`,
    };
  } else {
    const ftMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|'|x|by|\*)\s*(?:by|x|\*|\s+)?\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|'|room)?/i);
    if (ftMatch && (text.includes("room") || text.includes("fit") || text.includes("space") || text.includes("ft") || text.includes("feet") || text.includes("x"))) {
      const wFt = parseFloat(ftMatch[1]);
      const lFt = parseFloat(ftMatch[2]);
      if (wFt >= 4 && wFt <= 100 && lFt >= 4 && lFt <= 100) {
        ctx.roomDimensions = {
          width_feet: wFt,
          length_feet: lFt,
          width_cm: Math.round(wFt * 30.48),
          length_cm: Math.round(lFt * 30.48),
          raw: `${wFt}ft x ${lFt}ft`,
        };
      }
    }
  }

  // 2. Extract Budget
  const usdMatch = text.match(/\$\s*(\d+(?:,\d+)?(?:\.\d+)?)/);
  if (usdMatch) {
    ctx.budget = {
      max_price: parseFloat(usdMatch[1].replace(/,/g, "")),
      currency: "USD",
      raw: `$${usdMatch[1]}`,
    };
  } else {
    const budgetMatch = text.match(/(?:under|below|less than|max|budget)\s*(?:of\s*)?(?:rs\.?|rupees|\$)?\s*(\d+(?:,\d+)?)/i);
    if (budgetMatch) {
      const num = parseFloat(budgetMatch[1].replace(/,/g, ""));
      ctx.budget = {
        max_price: num,
        currency: text.includes("rupee") || text.includes("rs") ? "INR" : "USD",
        raw: `${num}`,
      };
    }
  }

  // 3. Extract Color Preferences
  const knownColors = ["blue", "navy", "grey", "gray", "cognac", "brown", "tan", "charcoal", "beige", "cream", "white", "black", "green", "sage", "emerald", "caramel", "espresso"];
  for (const color of knownColors) {
    if (text.includes(color) && !ctx.preferredColors.includes(color)) {
      ctx.preferredColors.push(color);
    }
  }

  // 4. Extract Material Preferences
  const knownMaterials = ["leather", "velvet", "fabric", "linen", "chenille", "boucle", "hardwood", "solid wood", "oak", "walnut", "ash"];
  for (const mat of knownMaterials) {
    if (text.includes(mat) && !ctx.preferredMaterials.includes(mat)) {
      ctx.preferredMaterials.push(mat);
    }
  }

  // 5. Extract Category
  const knownCategories = ["sofa", "sectional", "sleeper", "recliner", "glider", "gliding recliner", "study table", "desk", "chair", "table", "dining", "bed", "mattress"];
  for (const cat of knownCategories) {
    if (text.includes(cat)) {
      ctx.category = cat;
      break;
    }
  }

  return ctx;
}

export function cacheProductsInSession(sessionId: string, products: ProductSummary[]): void {
  if (!products || products.length === 0) return;
  const ctx = getSessionContext(sessionId);

  const formatted = products.map((p) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    price: p.minPrice,
    variantId: (p.matchedVariantId || p.id || "48745536979112").replace(/[^0-9]/g, ""),
  }));

  ctx.lastViewedProducts = formatted;
  if (formatted[0]) {
    ctx.activeProductInFocus = formatted[0];
  }
}

export function formatSessionContextForPrompt(sessionId: string): string {
  const ctx = getSessionContext(sessionId);
  const lines: string[] = ["[ACTIVE CUSTOMER SESSION PROFILE & CACHED CONTEXT]"];

  if (ctx.roomDimensions) {
    lines.push(`- Room Dimensions: ${ctx.roomDimensions.width_feet}ft × ${ctx.roomDimensions.length_feet}ft (${ctx.roomDimensions.raw})`);
  }
  if (ctx.budget && ctx.budget.max_price) {
    lines.push(`- Active Budget Cap: $${ctx.budget.max_price} USD`);
  }
  if (ctx.preferredColors.length > 0) {
    lines.push(`- Preferred Color(s): ${ctx.preferredColors.join(", ")}`);
  }
  if (ctx.preferredMaterials.length > 0) {
    lines.push(`- Preferred Material(s): ${ctx.preferredMaterials.join(", ")}`);
  }
  if (ctx.category) {
    lines.push(`- Active Category: ${ctx.category}`);
  }
  if (ctx.activeProductInFocus) {
    lines.push(`- Current Product In Focus: "${ctx.activeProductInFocus.title}" (Handle: ${ctx.activeProductInFocus.handle}, Price: $${ctx.activeProductInFocus.price})`);
  }
  if (ctx.lastViewedProducts.length > 0) {
    lines.push(`- Recent Products Shown: ${ctx.lastViewedProducts.map((p) => p.title).slice(0, 3).join("; ")}`);
  }

  if (lines.length === 1) {
    return "";
  }

  lines.push("CRITICAL: Maintain continuous contextual memory across turns. If the user refers to previously specified dimensions, colors, budgets, or products ('will it fit?', 'show in leather', 'add to cart'), use these cached parameters immediately!");

  return lines.join("\n");
}
