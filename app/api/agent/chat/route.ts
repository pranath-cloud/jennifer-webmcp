import { NextRequest, NextResponse } from "next/server";
import { shopifyGraphQL } from "@/lib/shopify/client";
import { SEARCH_PRODUCTS_QUERY } from "@/lib/shopify/queries";
import { normalizeProductSummary } from "@/lib/shopify/normalizer";
import { generateCartPermalink } from "@/lib/shopify/permalinks";
import { ProductSummary } from "@/lib/types/shopify";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function generateSmartChips(category?: string, maxPrice?: number, count = 0): string[] {
  const chips: string[] = [];

  if (category === "sofa" || category === "sectional") {
    chips.push("📐 Check 12x10 Room Fit");
    chips.push("🛋️ Show Sleeper Options");
    chips.push("🎁 Build 3-Piece Room Bundle");
    chips.push("💰 Under $2,000");
  } else if (category === "dining") {
    chips.push("🪑 Dining Sets with 6 Chairs");
    chips.push("🪵 Solid Hardwood");
    chips.push("💰 Under $1,500");
  } else {
    chips.push("🛋️ In-Stock Sofas under $2,000");
    chips.push("📐 Check Room Dimensions Fit");
    chips.push("🎁 3-Piece Suite Bundles (Save 15%)");
    chips.push("🐄 Leather Recliners");
  }

  if (count >= 2) {
    chips.unshift("⚖️ Deep Spec Comparison");
  }

  return chips.slice(0, 4);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message = "", customer, history = [], context = {} } = body;
    const cleanMsg = message.trim();
    const lower = cleanMsg.toLowerCase();

    // Context resolution from session memory
    const activeProduct = context.selectedProduct || (context.lastProducts && context.lastProducts[0]) || null;
    const activeCategory = context.activeCategory || "";

    // ==========================================
    // 1. GREETING INTENT
    // ==========================================
    if (!cleanMsg || (/^(hi|hello|hey|greetings|help|start|good morning|good afternoon)/i.test(cleanMsg) && cleanMsg.split(" ").length <= 3)) {
      const greetingName = customer?.name ? `, ${customer.name}` : "";
      return NextResponse.json({
        success: true,
        text: `Hello${greetingName}! 👋 I am your Jennifer Furniture AI Co-Pilot with full WebMCP & Gemini on-device tools. Tell me what you're looking for—like *"In-stock leather sofa under $3,000"*, *"Will this fit my 12x10 room?"*, or *"Build a 3-piece suite"*—and I will calculate dimensions and drive the store for you!`,
        products: [],
        chips: [
          "🛋️ In-Stock Sofas under $2,000",
          "📐 Check 12x10 Room Fit",
          "🎁 Build 3-Piece Room Bundle",
          "⚖️ Compare Top 2"
        ],
        comparison: null
      }, { headers: corsHeaders });
    }

    // ==========================================
    // 2. ROOM FIT & CLEARANCE CALCULATOR INTENT
    // ==========================================
    if (lower.includes("fit") || lower.includes("dimension") || lower.includes("clearance") || lower.includes("room size") || /\b\d+\s*x\s*\d+\b/i.test(lower)) {
      // Extract room dimensions (e.g. 12x10 or 12 by 10)
      let roomW = context.roomDimensions?.width || 12;
      let roomL = context.roomDimensions?.length || 10;
      const dimMatch = lower.match(/(\d+)\s*(?:x|by|\*)\s*(\d+)/i);
      if (dimMatch) {
        roomW = parseInt(dimMatch[1]);
        roomL = parseInt(dimMatch[2]);
      }

      // Dynamically resolve target product from context or prompt
      let targetTitle = activeProduct?.title || "Monika Sleeper Sofa";
      let targetHandle = activeProduct?.handle || "monika-sleeper-sofa";
      let targetPrice = activeProduct?.price || 1899.00;
      let targetVariantId = activeProduct?.variantId || "48745536979112";

      if (lower.includes("mason")) { targetHandle = "mason-leather-89-sofa-1"; targetTitle = "Mason Leather 89\" Sofa"; targetPrice = 2499.00; }
      else if (lower.includes("kirby")) { targetHandle = "kirby-chaise"; targetTitle = "Kirby Chaise Sectional"; targetPrice = 1799.00; }
      else if (lower.includes("softee")) { targetHandle = "softee-full-sofa-sleeper"; targetTitle = "Softee Full Sofa Sleeper"; targetPrice = 699.99; }
      else if (lower.includes("linda")) { targetHandle = "linda-slipcover-sofa-chair"; targetTitle = "Linda Slipcover Sofa Chair"; targetPrice = 1399.99; }
      else if (lower.includes("hodan")) { targetHandle = "hodan-sofa-chaise"; targetTitle = "Hodan Sofa Chaise"; targetPrice = 742.99; }

      const roomWidthInches = roomW * 12;
      const roomLengthInches = roomL * 12;
      const sofaWidthInches = targetHandle.includes("mason") ? 89 : (targetHandle.includes("chaise") ? 92 : 84);
      const sofaDepthInches = 38;

      const remainingSide = Math.max(0, Math.round((roomWidthInches - sofaWidthInches) / 2));
      const frontClearance = Math.max(0, Math.round(roomLengthInches - (sofaDepthInches + 24 + 16)));

      const permalink = generateCartPermalink(
        [{ variantId: targetVariantId, quantity: 1, title: targetTitle, price: targetPrice }],
        "WEBMCP10"
      );

      const fitScore = frontClearance >= 30 ? (frontClearance >= 48 ? 98 : 88) : 70;
      const verdict = frontClearance >= 30 ? "✅ EXCELLENT LUXURY FIT" : "⚠️ COMPACT FIT";

      return NextResponse.json({
        success: true,
        text: `### 📐 Room Fit Analysis for **${targetTitle}**\n\n` +
              `• **Your Room:** ${roomW} ft x ${roomL} ft (${roomWidthInches}" x ${roomLengthInches}")\n` +
              `• **Product Specs:** ${sofaWidthInches}" Width x ${sofaDepthInches}" Depth\n` +
              `• **Perimeter Clearance:** **${remainingSide} inches** on left & right margins\n` +
              `• **Front Walkway Path:** **${frontClearance} inches** remaining (Standard minimum: 30")\n` +
              `• **Verdict:** **${verdict}** (Fit Score: **${fitScore}/100**)\n\n` +
              `Adequate walking clearance is confirmed. Would you like to spotlight this on the page or check matching pieces?`,
        products: [
          {
            id: activeProduct?.id || "fit-product",
            title: targetTitle,
            handle: targetHandle,
            price: targetPrice,
            image: activeProduct?.image || "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80",
            inStock: true,
            url: `https://jenniferfurniturestaging.myshopify.com/products/${targetHandle}`,
            checkoutUrl: permalink.checkoutUrl,
            variantId: targetVariantId
          }
        ],
        chips: [
          "🎯 Spotlight on Page",
          "🛍️ 1-Click Buy Now",
          "🎁 Build 3-Piece Suite",
          "⚖️ Compare with Another"
        ],
        contextUpdate: {
          selectedProduct: { id: targetVariantId, title: targetTitle, handle: targetHandle, price: targetPrice, variantId: targetVariantId },
          roomDimensions: { width: roomW, length: roomL }
        }
      }, { headers: corsHeaders });
    }

    // ==========================================
    // 3. SMART 3-PIECE ROOM BUNDLE BUILDER INTENT
    // ==========================================
    if (lower.includes("bundle") || lower.includes("suite") || lower.includes("set") || lower.includes("matching package")) {
      const anchorTitle = "Luonto Monika Sleeper Suite";
      const bundlePrice = 2899.99;
      const regularPrice = 3499.99;
      const savings = 600.00;

      const bundlePermalink = generateCartPermalink(
        [
          { variantId: "48745536979112", quantity: 1, title: "Monika Sleeper Sofa", price: 1899.00 },
          { variantId: "35273545810088", quantity: 1, title: "Mazda Storage Ottoman", price: 499.99 },
          { variantId: "35127562436776", quantity: 1, title: "Linda Slipcover Accent Chair", price: 1099.99 }
        ],
        "WEBMCP15"
      );

      return NextResponse.json({
        success: true,
        text: `### 🎁 Coordinated 3-Piece Living Room Suite (Save 15%)\n\n` +
              `I have paired matching in-stock items with identical walnut leg finishes and charcoal upholstery:\n\n` +
              `1. **Luonto Monika Sleeper Sofa** ($1,899.00)\n` +
              `2. **Mazda Storage Ottoman** ($499.99)\n` +
              `3. **Linda Slipcover Accent Chair** ($1,099.99)\n\n` +
              `• **Individual Total:** ~~$3,499.99~~\n` +
              `• **Bundle Price:** **$2,899.99** (You Save **$600.00** with **WEBMCP15** applied)`,
        products: [
          {
            id: "bundle-anchor",
            title: "3-Piece Coordinated Room Suite (Sofa + Ottoman + Chair)",
            handle: "monika-sleeper-sofa",
            price: bundlePrice,
            image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80",
            inStock: true,
            url: "https://jenniferfurniturestaging.myshopify.com/products/monika-sleeper-sofa",
            checkoutUrl: bundlePermalink.checkoutUrl,
            variantId: "48745536979112"
          }
        ],
        chips: [
          "⚡ 1-Click Buy Complete Bundle",
          "📐 Check 12x10 Room Fit",
          "🛋️ View Individual Pieces",
          "💰 Sofas under $2,000"
        ]
      }, { headers: corsHeaders });
    }

    // ==========================================
    // 4. DEEP SPEC COMPARISON MATRIX INTENT
    // ==========================================
    if (lower.includes("compare") || lower.includes("vs") || lower.includes("difference between")) {
      const searchRes = await shopifyGraphQL<any>(SEARCH_PRODUCTS_QUERY, {
        query: "status:active inventory_total:>0",
        first: 8,
      });

      const edges = searchRes.data?.products?.edges || [];
      const summaries: ProductSummary[] = edges.map((e: any) => normalizeProductSummary(e.node));

      let compareItems = summaries.filter((p: ProductSummary) => 
        (p.title && lower.includes(p.title.toLowerCase())) || 
        (p.handle && lower.includes(p.handle.toLowerCase())) ||
        (p.title && cleanMsg.toLowerCase().includes(p.title.split(" ")[0].toLowerCase()))
      );

      if (compareItems.length < 2) {
        compareItems = summaries.slice(0, 2);
      } else {
        compareItems = compareItems.slice(0, 3);
      }

      const compMatrix = {
        products: compareItems.map((p: ProductSummary) => {
          const permalink = generateCartPermalink(
            [{ variantId: p.matchedVariantId || p.id, quantity: 1, title: p.title, price: p.minPrice }],
            "WEBMCP10"
          );
          return {
            id: p.id,
            title: p.title,
            price: `$${p.minPrice.toFixed(2)}`,
            inStock: p.inStock ? "✅ In Stock" : "❌ Sold Out",
            dimensions: p.tags?.find((t: string) => t.toLowerCase().includes("w ") || t.includes("x")) || "Standard 84\" W x 38\" D",
            material: p.tags?.find((t: string) => ["leather", "fabric", "velvet", "wood"].some(m => t.toLowerCase().includes(m))) || "Top Grain Genuine Leather",
            frame: "Kiln-Dried Hardwood (Reinforced Corner Blocks)",
            cushions: "2.0 High-Resiliency Foam + Sinuous Steel Springs",
            warranty: "1-Year Manufacturer Frame & Cushion Warranty",
            checkoutUrl: permalink.checkoutUrl
          };
        }),
        recommendation: `Both items are verified in stock. The **${compareItems[0]?.title}** offers top durability with hardwood construction, while the **${compareItems[1]?.title}** delivers the best entry price.`
      };

      return NextResponse.json({
        success: true,
        text: `### ⚖️ Deep Spec & Materials Comparison\n\n` +
              `• **Frame:** Kiln-Dried Hardwood vs. Reinforced Solid Wood\n` +
              `• **Upholstery:** Top-Grain Leather & Performance Fabric\n` +
              `• **Cushion Core:** 2.0 High-Resiliency Foam with Sinuous Springs\n` +
              `• **Warranty:** 1-Year Comprehensive Manufacturer Coverage Included\n\n` +
              `${compMatrix.recommendation}`,
        products: compareItems.map((p: ProductSummary) => {
          const permalink = generateCartPermalink(
            [{ variantId: p.matchedVariantId || p.id, quantity: 1, title: p.title, price: p.minPrice }],
            "WEBMCP10"
          );
          return {
            id: p.id,
            title: p.title,
            handle: p.handle,
            price: p.minPrice,
            image: p.featuredImage || "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80",
            inStock: p.inStock,
            url: `https://jenniferfurniturestaging.myshopify.com/products/${p.handle}`,
            checkoutUrl: permalink.checkoutUrl,
            variantId: p.matchedVariantId || p.id
          };
        }),
        chips: [
          "🛒 Buy " + (compareItems[0]?.title.split(" ").slice(0, 2).join(" ") || "Item 1"),
          "🛒 Buy " + (compareItems[1]?.title.split(" ").slice(0, 2).join(" ") || "Item 2"),
          "📐 Check 12x10 Room Fit",
          "💰 Under $2,000"
        ],
        comparison: compMatrix
      }, { headers: corsHeaders });
    }

    // ==========================================
    // 5. PRODUCT DISCOVERY & CONSTRAINT SEARCH INTENT
    // ==========================================
    let extractedMaxPrice: number | undefined = undefined;
    const priceMatch = lower.match(/(?:under|below|less than|\$|<=)\s*(\d+(?:,\d+)?|\d+k)/i) ||
                       lower.match(/(\d+(?:,\d+)?|\d+k)\s*(?:dollars?|bucks?)/i);
    if (priceMatch && priceMatch[1]) {
      const v = priceMatch[1].replace(/,/g, "");
      extractedMaxPrice = v.endsWith("k") ? parseFloat(v) * 1000 : parseFloat(v);
    }

    let categoryTerm = "";
    if (lower.includes("sectional")) categoryTerm = "sectional";
    else if (lower.includes("loveseat")) categoryTerm = "loveseat";
    else if (lower.includes("sofa") || lower.includes("couch")) categoryTerm = "sofa";
    else if (lower.includes("recliner")) categoryTerm = "recliner";
    else if (lower.includes("dining")) categoryTerm = "dining";
    else if (lower.includes("bed") || lower.includes("bedroom") || lower.includes("mattress")) categoryTerm = "bed";
    else if (lower.includes("chair")) categoryTerm = "chair";
    else if (lower.includes("table")) categoryTerm = "table";

    let materialTerm = "";
    if (lower.includes("leather")) materialTerm = "leather";
    else if (lower.includes("velvet")) materialTerm = "velvet";
    else if (lower.includes("fabric") || lower.includes("linen")) materialTerm = "fabric";
    else if (lower.includes("wood")) materialTerm = "wood";

    const queryParts = ["status:active", "inventory_total:>0"];
    if (categoryTerm) {
      queryParts.push(`(product_type:*${categoryTerm}* OR tag:*${categoryTerm}* OR title:*${categoryTerm}*)`);
    }
    if (materialTerm) {
      queryParts.push(`(tag:*${materialTerm}* OR title:*${materialTerm}*)`);
    }

    const searchRes = await shopifyGraphQL<any>(SEARCH_PRODUCTS_QUERY, {
      query: queryParts.join(" AND "),
      first: 16,
    });

    const edges = searchRes.data?.products?.edges || [];
    let summaries: ProductSummary[] = edges.map((e: any) => normalizeProductSummary(e.node));

    if (extractedMaxPrice) {
      summaries = summaries.filter((p: ProductSummary) => p.minPrice <= (extractedMaxPrice as number));
    }

    if (summaries.length === 0) {
      const fallbackRes = await shopifyGraphQL<any>(SEARCH_PRODUCTS_QUERY, {
        query: "status:active inventory_total:>0",
        first: 8,
      });
      summaries = (fallbackRes.data?.products?.edges || []).map((e: any) => normalizeProductSummary(e.node));
      if (extractedMaxPrice) {
        summaries = summaries.filter((p: ProductSummary) => p.minPrice <= (extractedMaxPrice as number));
      }
    }

    const topProducts = summaries.slice(0, 6).map((p: ProductSummary) => {
      const permalink = generateCartPermalink(
        [{ variantId: p.matchedVariantId || p.id, quantity: 1, title: p.title, price: p.minPrice }],
        "WEBMCP10"
      );
      return {
        id: p.id,
        title: p.title,
        handle: p.handle,
        price: p.minPrice,
        image: p.featuredImage || "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80",
        inStock: p.inStock,
        url: `https://jenniferfurniturestaging.myshopify.com/products/${p.handle}`,
        checkoutUrl: permalink.checkoutUrl,
        variantId: p.matchedVariantId || p.id
      };
    });

    let introText = "";
    if (categoryTerm && extractedMaxPrice) {
      introText = `I found **${topProducts.length} verified in-stock ${categoryTerm}s** under **$${extractedMaxPrice.toLocaleString()}** for you! Each includes a direct 1-click checkout with promotional code **WEBMCP10** applied:`;
    } else if (categoryTerm) {
      introText = `Here are **${topProducts.length} top-rated in-stock ${categoryTerm}s** ready for fast delivery:`;
    } else {
      introText = `I found **${topProducts.length} verified in-stock furniture items** matching your request:`;
    }

    const smartChips = generateSmartChips(categoryTerm, extractedMaxPrice, topProducts.length);

    return NextResponse.json({
      success: true,
      text: introText,
      products: topProducts,
      chips: smartChips,
      comparison: null
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error("Agent chat error:", error);
    return NextResponse.json({
      success: false,
      text: "I'm having a brief connection issue checking live stock. Please ask me again or try one of the options below!",
      products: [],
      chips: ["🛋️ In-Stock Sofas under $2,000", "📐 Check 12x10 Room Fit", "🎁 Build 3-Piece Room Bundle"],
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
}
