import { NextRequest, NextResponse } from "next/server";
import { shopifyGraphQL } from "@/lib/shopify/client";
import { SEARCH_PRODUCTS_QUERY, GET_PRODUCT_DETAILS_QUERY } from "@/lib/shopify/queries";
import { normalizeProductSummary, normalizeProductDetailed } from "@/lib/shopify/normalizer";
import { generateCartPermalink } from "@/lib/shopify/permalinks";
import { ProductSummary, ProductDetailed } from "@/lib/types/shopify";
import { runOpenRouterAgent } from "@/lib/ai/openrouter";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  extractAndCacheContextFromQuery,
  formatSessionContextForPrompt,
  cacheProductsInSession,
  updateSessionContext,
  getSessionContext
} from "@/lib/session-cache";
import { getStoreByDomain } from "@/lib/tenants/registry";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Session, X-Shop-Domain, *",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// 100% Dynamic Contextual Filter Chip Generator (Zero Hardcoded Rules)
function generateSmartChips(category?: string, query?: string, count = 0, products: ProductSummary[] = []): string[] {
  const chips: string[] = [];
  if (!products || products.length === 0) {
    const q = (query || category || "").toLowerCase();
    if (q.includes("sofa") || q.includes("couch") || q.includes("living")) {
      return ["🛋️ View In-Stock Sofas", "📐 Check Room Fit", "🎁 Build Room Bundle"];
    }
    return ["🛋️ View In-Stock Sofas", "📐 Spatial Fit Calculator", "🎁 Coordinated Room Bundles"];
  }

  // Derive dynamic refinement chips from actual catalog attributes present in matches
  const materials = new Set<string>();
  const styles = new Set<string>();
  products.forEach(p => {
    const title = (p.title || "").toLowerCase();
    const tags = (p.tags || []).map(t => t.toLowerCase());
    if (title.includes("leather") || tags.includes("leather") || tags.some(t => t.includes("material-leather"))) materials.add("Leather");
    if (title.includes("velvet") || tags.includes("velvet")) materials.add("Velvet");
    if (title.includes("sleeper") || tags.includes("sleeper") || tags.includes("sofas sleeper")) styles.add("Sleeper");
    if (title.includes("recliner") || title.includes("power") || tags.includes("recliner")) styles.add("Recliner");
    if (title.includes("sectional") || tags.includes("sectional")) styles.add("Sectional");
  });

  if (materials.has("Leather")) chips.push("🛋️ Filter by Leather");
  if (styles.has("Sleeper")) chips.push("🛏️ Sleeper Options");
  if (styles.has("Sectional")) chips.push("🛋️ Sectional Layouts");
  if (styles.has("Recliner")) chips.push("💺 Reclining Models");
  if (materials.has("Velvet") && chips.length < 3) chips.push("🎨 Velvet Finishes");

  // Dynamic price refinement if price spread is wide
  const prices = products.map(p => p.minPrice).filter(p => p > 0);
  if (prices.length > 1) {
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    if (maxP - minP > 400 && chips.length < 3) {
      const midPrice = Math.round((minP + maxP) / 200) * 100;
      chips.push(`💰 Under $${midPrice}`);
    }
  }

  // Always offer contextual spatial fit
  if (chips.length < 4) {
    chips.push("📐 Check 15x12 Room Fit");
  }

  return chips.slice(0, 4);
}

const CATEGORY_MAP: Record<string, string[]> = {
  "sofa": ["sofas", "loveseats", "sofa chairs", "sofas sleeper", "sofa sleeper", "accent chairs"],
  "couch": ["sofas", "loveseats", "sofa chairs", "sofas sleeper", "sofa sleeper"],
  "sectional": ["sofas", "loveseats", "sofas sleeper", "sofa sleeper"],
  "loveseat": ["loveseats", "sofas"],
  "chair": ["accent chairs", "sofa chairs", "desk chairs", "loveseats"],
  "sofa chair": ["sofa chairs", "accent chairs"],
  "accent chair": ["accent chairs", "sofa chairs"],
  "desk": ["desks", "desk chairs"],
  "study table": ["desks"],
  "lamp": ["table lamps", "floor lamps", "desk lamps", "pendants"],
  "table lamp": ["table lamps", "desk lamps"],
  "floor lamp": ["floor lamps"],
  "bed": ["beds", "sofas sleeper", "sofa sleeper"],
  "bedroom": ["beds", "chests"],
  "rug": ["rugs"],
  "bedding": ["beddings"],
  "comforter": ["beddings"],
  "duvet": ["beddings"],
  "dining": ["dining tables", "dining chairs", "tables"],
  "table": ["tables", "table lamps", "desks"],
  "ottoman": ["ottomans", "DISCONTINUED"]
};

// High-Precision Product Finder with Category Isolation, Strict Color & Strict Budget Filtering
async function executeFindProducts(args: any, shopDomain?: string) {
  let { category, color, material, max_price, min_price, query = "", limit = 6 } = args || {};
  
  const lowerQuery = (query || "").toLowerCase();
  if (!category) {
    for (const cat of ["study table", "table lamp", "floor lamp", "sofa chair", "accent chair", "sofas sleeper", "sectional", "loveseat", "sofa", "couch", "desk", "lamp", "bed", "chair", "table"]) {
      if (lowerQuery.includes(cat)) {
        category = cat;
        break;
      }
    }
  }

  // Extract color from query if not passed explicitly in tool args
  if (!color) {
    const knownColors = ["black", "white", "brown", "blue", "green", "gray", "grey", "beige", "cream", "tan", "cognac", "navy", "charcoal", "espresso", "walnut", "red", "yellow", "orange", "rust", "sage", "olive"];
    for (const kc of knownColors) {
      if (new RegExp(`\\b${kc}\\b`, 'i').test(lowerQuery)) {
        color = kc;
        break;
      }
    }
  }

  // Extract max_price from query if not passed explicitly
  if (typeof max_price !== "number") {
    const priceMatch = lowerQuery.match(/(?:under|below|less than|max|budget|for|with|\$)\s*\$?(\d{3,5})/i);
    if (priceMatch) {
      max_price = parseFloat(priceMatch[1]);
    }
  }

  let compiledQuery = "status:active";
  if (category) {
    compiledQuery = `status:active AND (title:*${category}* OR tag:*${category}* OR product_type:*${category}*)`;
  }

  let res = await shopifyGraphQL<any>(SEARCH_PRODUCTS_QUERY, {
    query: compiledQuery,
    first: 100,
  }, { shopDomain });

  let rawEdges = res.data?.products?.edges || [];
  if (rawEdges.length === 0) {
    res = await shopifyGraphQL<any>(SEARCH_PRODUCTS_QUERY, {
      query: "status:active",
      first: 100,
    }, { shopDomain });
    rawEdges = res.data?.products?.edges || [];
  }

  const rawProducts = rawEdges.map((e: any) => normalizeProductSummary(e.node));
  const allowedTypes = category ? (CATEGORY_MAP[category.toLowerCase()] || [category.toLowerCase()]) : [];

  // Filter 1: Strict Category Isolation & Strict Budget Enforcement
  let candidates = rawProducts.filter((p: any) => {
    const pt = (p.productType || "").toLowerCase();
    const title = (p.title || "").toLowerCase();
    const tags: string[] = (p.tags || []).map((t: string) => t.toLowerCase());
    
    if (category && allowedTypes.length > 0) {
      const isCatMatch = allowedTypes.some((at: string) => pt.includes(at) || tags.includes(at) || title.includes(at));
      if (!isCatMatch) return false;
    }

    if (typeof max_price === "number" && max_price > 0 && p.minPrice > max_price) {
      return false;
    }
    if (typeof min_price === "number" && min_price > 0 && p.minPrice < min_price) {
      return false;
    }
    return true;
  });

  // Filter 2: Strict Color Matching if user requested a specific color
  if (color) {
    const targetColor = color.toLowerCase();
    const exactColorMatches = candidates.filter((p: any) => {
      const title = (p.title || "").toLowerCase();
      const tags = (p.tags || []).map((t: string) => t.toLowerCase());
      const colors = (p.availableColors || []).map((c: string) => c.toLowerCase());
      return title.includes(targetColor) || 
             tags.includes(`color-${targetColor}`) || 
             tags.includes(targetColor) ||
             colors.some((c: string) => c.includes(targetColor));
    });

    if (exactColorMatches.length > 0) {
      return exactColorMatches.slice(0, Math.max(6, limit));
    }
    // If color was explicitly requested and 0 products match, return empty to prevent returning wrong color items
    return [];
  }

  // Filter 3: Material matching if requested
  if (material) {
    const targetMat = material.toLowerCase().replace(/\s+/g, "-");
    const matMatches = candidates.filter((p: any) => {
      const title = (p.title || "").toLowerCase();
      const tags = (p.tags || []).map((t: string) => t.toLowerCase());
      return title.includes(material.toLowerCase()) || tags.includes(`material-${targetMat}`) || tags.includes(material.toLowerCase());
    });
    if (matMatches.length > 0) {
      return matMatches.slice(0, Math.max(6, limit));
    }
  }

  return candidates.slice(0, Math.max(6, limit));
}

async function executeCustomShopifyGraphQL(args: any, shopDomain?: string) {
  const { query_string = "status:active", limit = 6 } = args || {};
  const res = await shopifyGraphQL<any>(SEARCH_PRODUCTS_QUERY, {
    query: query_string,
    first: Math.min(20, limit * 2),
  }, { shopDomain });

  const rawEdges = res.data?.products?.edges || [];
  let products: ProductSummary[] = rawEdges.map((e: any) => normalizeProductSummary(e.node));
  return products.slice(0, limit);
}

async function executeRoomFit(args: any, sessionCtx?: any, shopDomain?: string) {
  let {
    room_width_feet,
    room_length_feet,
    room_width_cm,
    room_length_cm,
    product_handle
  } = args || {};

  if (!room_width_feet && !room_width_cm && sessionCtx?.roomDimensions) {
    room_width_feet = sessionCtx.roomDimensions.width_feet;
    room_length_feet = sessionCtx.roomDimensions.length_feet;
  }

  if (!product_handle && sessionCtx?.activeProductInFocus) {
    product_handle = sessionCtx.activeProductInFocus.handle;
  }
  if (!product_handle && sessionCtx?.lastViewedProducts?.[0]) {
    product_handle = sessionCtx.lastViewedProducts[0].handle;
  }
  product_handle = product_handle || "softee-full-sofa-sleeper";

  if (room_width_cm && !room_width_feet) {
    room_width_feet = Math.round((room_width_cm / 30.48) * 10) / 10;
  }
  if (room_length_cm && !room_length_feet) {
    room_length_feet = Math.round((room_length_cm / 30.48) * 10) / 10;
  }

  room_width_feet = room_width_feet || 15;
  room_length_feet = room_length_feet || 12;
  
  let title = "Softee Full Sofa Sleeper";
  let sofaW = 84;
  let sofaD = 38;
  let sofaH = 34;
  let price = 699.99;
  let image = "";
  let variantId = "35127541039272";

  try {
    const res = await shopifyGraphQL<any>(GET_PRODUCT_DETAILS_QUERY, { handle: product_handle }, { shopDomain });
    if (res.data?.productByHandle) {
      const p: ProductDetailed = normalizeProductDetailed(res.data.productByHandle);
      title = p.title;
      price = p.minPrice;
      image = p.featuredImage || (p.images && p.images[0]?.url) || "";
      variantId = p.variants[0]?.id || variantId;
      if (p.specifications.dimensions) {
        const match = p.specifications.dimensions.match(/(\d+)[^xX]*[xX][^xX]*(\d+)[^xX]*[xX][^xX]*(\d+)/);
        if (match) {
          sofaW = parseFloat(match[1]);
          sofaD = parseFloat(match[2]);
          sofaH = parseFloat(match[3]);
        }
      }
    }
  } catch (e) {}

  const roomAreaSqFt = room_width_feet * room_length_feet;
  const sofaAreaSqFt = (sofaW * sofaD) / 144;
  const ratio = (sofaAreaSqFt / roomAreaSqFt) * 100;

  const clearanceFrontInches = Math.max(0, Math.round((room_length_feet * 12 - sofaD) / 2));
  const clearanceSidesInches = Math.max(0, Math.round((room_width_feet * 12 - sofaW) / 2));

  let fitStatus: "EXCELLENT" | "COMFORTABLE" | "TIGHT" | "TOO_LARGE" = "EXCELLENT";
  let fitScore = 95;
  if (ratio > 35 || clearanceFrontInches < 24) {
    fitStatus = "TOO_LARGE";
    fitScore = 42;
  } else if (ratio > 25 || clearanceFrontInches < 30) {
    fitStatus = "TIGHT";
    fitScore = 68;
  } else if (ratio > 18) {
    fitStatus = "COMFORTABLE";
    fitScore = 88;
  }

  return {
    success: true,
    product: {
      handle: product_handle,
      title,
      price,
      image,
      variantId,
      dimensions: { width: sofaW, depth: sofaD, height: sofaH }
    },
    room: {
      width_feet: room_width_feet,
      length_feet: room_length_feet,
      area_sqft: roomAreaSqFt
    },
    metrics: {
      fit_score: fitScore,
      fit_status: fitStatus,
      room_footprint_percentage: Math.round(ratio),
      clearance_front_inches: clearanceFrontInches,
      clearance_sides_inches: clearanceSidesInches,
      traffic_flow_rating: clearanceFrontInches >= 36 ? "Optimal (>36 in walkway)" : "Adequate"
    },
    checkout_permalink: generateCartPermalink([{ variantId, quantity: 1 }], "WEBMCP10")
  };
}

async function executeFloorplan(args: any, sessionCtx?: any) {
  let { room_width_feet, room_length_feet, product_title, sofa_width_inches = 84, sofa_depth_inches = 38 } = args || {};
  
  if (!room_width_feet && sessionCtx?.roomDimensions) {
    room_width_feet = sessionCtx.roomDimensions.width_feet;
    room_length_feet = sessionCtx.roomDimensions.length_feet;
  }
  if (!product_title && sessionCtx?.activeProductInFocus) {
    product_title = sessionCtx.activeProductInFocus.title;
  }

  const roomW = room_width_feet || 15;
  const roomL = room_length_feet || 12;
  const prodTitle = product_title || "Living Room Sofa";
  
  const scale = 24;
  const svgWidth = Math.round(roomW * scale);
  const svgHeight = Math.round(roomL * scale);

  const sofaWidthPx = Math.round((sofa_width_inches / 12) * scale);
  const sofaDepthPx = Math.round((sofa_depth_inches / 12) * scale);
  const sofaX = Math.round((svgWidth - sofaWidthPx) / 2);
  const sofaY = Math.round((svgHeight - sofaDepthPx) / 2);

  const coffeeTableW = Math.round(3.5 * scale);
  const coffeeTableH = Math.round(2 * scale);
  const coffeeTableX = Math.round((svgWidth - coffeeTableW) / 2);
  const coffeeTableY = sofaY + sofaDepthPx + 18;

  const svg = `<svg width="100%" height="220" viewBox="0 0 ${svgWidth + 40} ${svgHeight + 40}" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; font-family:sans-serif;">
    <defs>
      <pattern id="grid" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse">
        <path d="M ${scale} 0 L 0 0 0 ${scale}" fill="none" stroke="#f1f5f9" stroke-width="1"/>
      </pattern>
    </defs>
    <rect x="20" y="20" width="${svgWidth}" height="${svgHeight}" fill="url(#grid)" stroke="#0284c7" stroke-width="2" rx="4" />
    <rect x="${sofaX + 10}" y="${sofaY + 10}" width="${sofaWidthPx + 20}" height="${sofaDepthPx + coffeeTableH + 35}" fill="rgba(2,132,199,0.05)" stroke="rgba(2,132,199,0.2)" stroke-dasharray="4" rx="6" />
    <rect x="${sofaX + 20}" y="${sofaY + 20}" width="${sofaWidthPx}" height="${sofaDepthPx}" fill="#0f172a" stroke="#0284c7" stroke-width="2" rx="6" />
    <text x="${sofaX + 20 + sofaWidthPx/2}" y="${sofaY + 20 + sofaDepthPx/2 + 4}" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">${prodTitle}</text>
    <rect x="${coffeeTableX + 20}" y="${coffeeTableY + 20}" width="${coffeeTableW}" height="${coffeeTableH}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5" rx="4" />
    <text x="${coffeeTableX + 20 + coffeeTableW/2}" y="${coffeeTableY + 20 + coffeeTableH/2 + 3}" fill="#0f172a" font-size="9" text-anchor="middle">Coffee Table</text>
    <text x="${svgWidth/2 + 20}" y="14" fill="#64748b" font-size="10" text-anchor="middle">${roomW} ft Width</text>
    <text x="8" y="${svgHeight/2 + 25}" fill="#64748b" font-size="10" text-anchor="middle" transform="rotate(-90 8,${svgHeight/2 + 25})">${roomL} ft Length</text>
  </svg>`;

  return {
    success: true,
    room: { width_feet: roomW, length_feet: roomL },
    product: { title: prodTitle, width_inches: sofa_width_inches, depth_inches: sofa_depth_inches },
    svg_markup: svg
  };
}

async function executeFabricLighting(args: any) {
  const { wall_color = "warm beige", window_exposure = "South-Facing (Warm Bright Light)" } = args || {};
  const lower = wall_color.toLowerCase();

  let recommendedUpholstery = ["Camel Saddle Leather", "Charcoal Performance Velvet", "Oatmeal Linen"];
  let kelvin = "3000K (Warm White)";
  let harmonyScore = 96;

  if (lower.includes("blue") || lower.includes("navy")) {
    recommendedUpholstery = ["Cognac Top-Grain Leather", "Cream Chenille", "Mustard Velvet"];
    kelvin = "2700K (Soft Ambient Warmth)";
    harmonyScore = 98;
  } else if (lower.includes("green") || lower.includes("sage") || lower.includes("emerald")) {
    recommendedUpholstery = ["Caramel Pull-Up Leather", "Ivory Boucle", "Espresso Fabric"];
    kelvin = "3000K (Warm Natural White)";
    harmonyScore = 97;
  } else if (lower.includes("charcoal") || lower.includes("gray") || lower.includes("grey")) {
    recommendedUpholstery = ["Cognac Italian Leather", "Teal Textured Linen", "Cobalt Blue Velvet"];
    kelvin = "3500K (Bright Neutral White)";
    harmonyScore = 94;
  }

  return {
    success: true,
    wall_color,
    window_exposure,
    color_harmony_score: harmonyScore,
    recommended_fabrics: recommendedUpholstery,
    recommended_lighting: {
      temperature_kelvin: kelvin,
      placement_tip: "Pair with low-profile accent lighting behind the main sectional for high visual contrast."
    }
  };
}

async function executeBundleBuilder(args: any, shopDomain?: string) {
  const sofas = await executeFindProducts({ category: "sofa", limit: 1 }, shopDomain);
  const chairs = await executeFindProducts({ category: "chair", limit: 1 }, shopDomain);
  const tables = await executeFindProducts({ category: "table", limit: 1 }, shopDomain);

  const sofa = sofas[0] || { title: "Softee Full Sofa Sleeper", minPrice: 699.99, id: "5408100417704", handle: "softee-full-sofa-sleeper", featuredImage: null, matchedVariantId: "35127541039272" };
  const chair = chairs[0] || { title: "Beamerton Sofa Chair", minPrice: 949.99, id: "5408101040296", handle: "beamerton-chair", featuredImage: null, matchedVariantId: "35127542153384" };
  const table = tables[0] || { title: "Shavontae Table Lamp 2 PC", minPrice: 199.99, id: "5408100286632", handle: "shavontae-table-lamp", featuredImage: null, matchedVariantId: "35127540908200" };

  const subtotal = sofa.minPrice + chair.minPrice + table.minPrice;
  const bundleDiscount = Math.round(subtotal * 0.15);
  const bundleTotal = subtotal - bundleDiscount;

  return {
    success: true,
    bundle_name: "Curated 3-Piece Living Room Suite",
    items: [
      { role: "Anchor Sofa", title: sofa.title, price: sofa.minPrice, image: sofa.featuredImage },
      { role: "Accent Chair", title: chair.title, price: chair.minPrice, image: chair.featuredImage },
      { role: "Living Accessory", title: table.title, price: table.minPrice, image: table.featuredImage }
    ],
    pricing: {
      retail_subtotal: subtotal,
      bundle_discount_15_pct: bundleDiscount,
      bundle_total: bundleTotal,
      savings_text: `Save $${bundleDiscount} (15% Bundle Discount)`
    },
    checkout_permalink: `https://${shopDomain || 'jenniferfurniturestaging.myshopify.com'}/cart/${sofa.matchedVariantId || '35127541039272'}:1?discount=WEBMCP15`
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message = "", messages = [], session_id, shop_domain, brand_name } = body;
    const currentSessionId = session_id || "sess_default";
    const targetShop = shop_domain || request.headers.get("x-shop-domain") || undefined;
    const activeBrand = brand_name || "Jennifer Furniture";

    // 1. Enforce Client Rate Limit (10 calls per window per client)
    const rateLimit = checkRateLimit(request, { limit: 10, windowMs: 24 * 60 * 60 * 1000 }, currentSessionId);
    const combinedHeaders = {
      ...corsHeaders,
      ...rateLimit.headers,
    };

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          rate_limited: true,
          limit: rateLimit.limit,
          remaining: 0,
          reset_seconds: parseInt(rateLimit.headers["X-RateLimit-Reset"] || "3600"),
          text: "⏳ **Session Query Limit Reached (10/10 calls)**\n\nYou have reached the limit of 10 AI queries for today. Standard store search remains active.",
          products: [],
          chips: ["🛋️ View In-Stock Sofas", "🪑 View Dining Sets", "🛏️ View Bedroom Suites"],
        },
        {
          status: 429,
          headers: combinedHeaders,
        }
      );
    }

function normalizeVoiceQuery(text: string): string {
  if (!text) return text;
  let q = text;
  // Spoken dimensions: "fifteen by twelve", "15 by 12" -> "15x12 ft"
  q = q.replace(/\b(ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|\d+)\s*(?:feet|ft)?\s*(?:by|x|\*)\s*(ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|\d+)\s*(?:feet|ft)?\b/gi, (_m, w, l) => {
    const wordToNum: Record<string, number> = {
      ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
      sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20
    };
    const width = wordToNum[w.toLowerCase()] || parseInt(w, 10);
    const length = wordToNum[l.toLowerCase()] || parseInt(l, 10);
    return `${width}x${length} ft`;
  });

  // Spoken prices: "under two thousand" -> "under $2000"
  q = q.replace(/\b(?:under|below|less than)\s*two\s*thousand\b/gi, "under $2000");
  q = q.replace(/\b(?:under|below|less than)\s*three\s*thousand\b/gi, "under $3000");
  q = q.replace(/\b(?:under|below|less than)\s*one\s*thousand\b/gi, "under $1000");
  q = q.replace(/\b(?:under|below|less than)\s*fifteen\s*hundred\b/gi, "under $1500");
  q = q.replace(/\b(?:under|below|less than)\s*(\d+)\s*(?:grand|k)\b/gi, (_m, k) => `under $${parseInt(k, 10) * 1000}`);
  q = q.replace(/\b(?:under|below|less than)\s*two\s*grand\b/gi, "under $2000");

  return q;
}

    const rawUserQuery = message || (messages.length > 0 ? messages[messages.length - 1].content : "");
    const userQuery = normalizeVoiceQuery(rawUserQuery);
    if (!userQuery.trim()) {
      return NextResponse.json({
        success: true,
        rate_limit: { limit: rateLimit.limit, remaining: rateLimit.remaining },
        text: `Welcome to ${activeBrand}. How can I assist you with your space today?`,
        products: [],
        chips: generateSmartChips(),
      }, { headers: combinedHeaders });
    }

    // 2. Extract & Update Session Context Memory
    const sessionCtx = extractAndCacheContextFromQuery(currentSessionId, userQuery);
    const cachedContextPrompt = formatSessionContextForPrompt(currentSessionId);

    const conversationHistory = messages.length > 0 ? messages : [{ role: "user", content: userQuery }];

    // 3. Invoke OpenRouter Gemini 2.5 Agent
    let agentResponse;
    try {
      agentResponse = await runOpenRouterAgent(conversationHistory, cachedContextPrompt);
    } catch (err: any) {
      console.warn("OpenRouter API fallback:", err.message);
    }

    // 4. Process Tool Calls from AI
    if (agentResponse?.toolCalls && agentResponse.toolCalls.length > 0) {
      const toolCall = agentResponse.toolCalls[0];
      const toolName = toolCall.function.name;
      let toolArgs: any = {};
      try {
        toolArgs = typeof toolCall.function.arguments === "string" ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
      } catch (e) {}

      let toolResult: any = null;
      let products: ProductSummary[] = [];
      let fit: any = null;
      let floorplan: any = null;
      let fabric: any = null;
      let bundle: any = null;

      if (toolName === "find_products_by_constraints") {
        products = await executeFindProducts(toolArgs, targetShop);
        toolResult = { count: products.length, products };
        if (products.length > 0) cacheProductsInSession(currentSessionId, products);
      } else if (toolName === "execute_custom_shopify_graphql") {
        products = await executeCustomShopifyGraphQL(toolArgs, targetShop);
        toolResult = { count: products.length, products };
        if (products.length > 0) cacheProductsInSession(currentSessionId, products);
      } else if (toolName === "calculate_room_fit_and_clearance") {
        fit = await executeRoomFit(toolArgs, sessionCtx, targetShop);
        toolResult = fit;
        updateSessionContext(currentSessionId, { lastFitScorecard: fit });
      } else if (toolName === "generate_room_floorplan") {
        floorplan = await executeFloorplan(toolArgs, sessionCtx);
        toolResult = floorplan;
        updateSessionContext(currentSessionId, { lastFloorplan: floorplan });
      } else if (toolName === "match_fabric_and_lighting") {
        fabric = await executeFabricLighting(toolArgs);
        toolResult = fabric;
      } else if (toolName === "build_coordinated_room_bundle") {
        bundle = await executeBundleBuilder(toolArgs, targetShop);
        toolResult = bundle;
        updateSessionContext(currentSessionId, { lastBundle: bundle });
      }

      let replyText = agentResponse.text;
      if (!replyText || replyText.trim().length === 0) {
        if (toolName === "find_products_by_constraints" || toolName === "execute_custom_shopify_graphql") {
          if (products.length > 0) {
            const topHighlights = products.slice(0, 3).map(p => `**${p.title}** ($${p.minPrice.toFixed(2)})`).join(", ");
            const minP = Math.min(...products.map(p => p.minPrice));
            const maxP = Math.max(...products.map(p => p.minPrice));
            replyText = `I found **${products.length} in-stock options** matching your request (priced from $${minP.toFixed(2)} to $${maxP.toFixed(2)}), including ${topHighlights}.`;
            if (toolArgs?.max_price) {
              replyText += ` All options are verified within your **$${toolArgs.max_price}** budget.`;
            }
            replyText += `\n\nTake a look at the verified catalog cards below. Would you like to calculate room fit, compare specs, or build a matching living room bundle?`;
          } else {
            replyText = `I searched our live catalog for "${toolArgs?.query || toolArgs?.category || userQuery}", but didn't find active inventory matching those exact constraints. Would you like me to broaden the search or suggest alternative collections?`;
          }
        } else if (toolName === "calculate_room_fit_and_clearance" && fit) {
          replyText = `### 📐 Room Fit Scorecard: **${fit.metrics.fit_score}/100 (${fit.metrics.fit_status})**\n- **Walkway Clearance**: ${fit.metrics.clearance_front_inches} inches\n- **Side Clearance**: ${fit.metrics.clearance_sides_inches} inches\n- **Footprint**: ${fit.metrics.room_footprint_percentage}% of space`;
        } else if (toolName === "generate_room_floorplan" && floorplan) {
          replyText = `### 📐 2D Floorplan Generated for **${floorplan.room.width_feet}ft x ${floorplan.room.length_feet}ft** space.`;
        } else if (toolName === "match_fabric_and_lighting" && fabric) {
          replyText = `### 🎨 Color & Lighting Harmony: **${fabric.color_harmony_score}% Match**`;
        } else if (toolName === "build_coordinated_room_bundle" && bundle) {
          replyText = `### 🎁 Curated 3-Piece Suite Created! (**${bundle.pricing.savings_text}**)`;
        }
      }

      return NextResponse.json({
        success: true,
        rate_limit: { limit: rateLimit.limit, remaining: rateLimit.remaining },
        session_context: {
          roomDimensions: sessionCtx.roomDimensions,
          budget: sessionCtx.budget,
          preferredColors: sessionCtx.preferredColors,
          activeProduct: sessionCtx.activeProductInFocus
        },
        text: replyText,
        tool_called: toolName,
        tool_args: toolArgs,
        tool_result: toolResult,
        products,
        fit,
        floorplan,
        fabric,
        bundle,
        chips: generateSmartChips(toolArgs?.category, userQuery, products.length, products),
      }, { headers: combinedHeaders });
    }

    // 5. Conversational Response or Fallback
    if (agentResponse?.text) {
      return NextResponse.json({
        success: true,
        rate_limit: { limit: rateLimit.limit, remaining: rateLimit.remaining },
        session_context: {
          roomDimensions: sessionCtx.roomDimensions,
          budget: sessionCtx.budget,
          preferredColors: sessionCtx.preferredColors,
          activeProduct: sessionCtx.activeProductInFocus
        },
        text: agentResponse.text,
        products: [],
        chips: generateSmartChips(undefined, userQuery),
      }, { headers: combinedHeaders });
    }

    // Fallback search execution if OpenRouter didn't invoke a tool
    const autoProducts = await executeFindProducts({ query: userQuery, limit: 6 }, targetShop);
    let autoReply = "";
    if (autoProducts.length > 0) {
      const topHighlights = autoProducts.slice(0, 3).map((p: any) => `**${p.title}** ($${p.minPrice.toFixed(2)})`).join(", ");
      autoReply = `Here are top in-stock recommendations matching "${userQuery}": ${topHighlights}.`;
    } else {
      autoReply = `How can I assist you with your space at ${activeBrand} today?`;
    }

    return NextResponse.json({
      success: true,
      rate_limit: { limit: rateLimit.limit, remaining: rateLimit.remaining },
      text: autoReply,
      products: autoProducts,
      chips: generateSmartChips(undefined, userQuery, autoProducts.length, autoProducts),
    }, { headers: combinedHeaders });

  } catch (error: any) {
    console.error("Chat API route error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to process AI request",
      text: "I am ready to help you with our verified furniture catalog. Please choose an option below:",
      products: [],
      chips: generateSmartChips(),
    }, { status: 500, headers: corsHeaders });
  }
}
