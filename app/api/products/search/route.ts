import { NextRequest, NextResponse } from "next/server";
import { shopifyGraphQL } from "@/lib/shopify/client";
import { SEARCH_PRODUCTS_QUERY } from "@/lib/shopify/queries";
import { normalizeProductSummary } from "@/lib/shopify/normalizer";

// Natural Language Intent Parser
function parseNaturalQuery(text: string) {
  const lower = text.toLowerCase();
  let extractedCategory = "";
  let extractedMaxPrice: number | undefined = undefined;
  let extractedMaterial = "";
  const extractedFeatures: string[] = [];

  // 1. Price extraction ($4000, under 4000, < 4000, 4k)
  const priceMatch = lower.match(/(?:under|below|less than|\$|<=)\s*(\d+(?:,\d+)?|\d+k)/i) ||
                     lower.match(/(\d+(?:,\d+)?|\d+k)\s*(?:dollars?|bucks?)/i);
  if (priceMatch && priceMatch[1]) {
    let valStr = priceMatch[1].replace(/,/g, "");
    if (valStr.endsWith("k")) {
      extractedMaxPrice = parseFloat(valStr) * 1000;
    } else {
      extractedMaxPrice = parseFloat(valStr);
    }
  }

  // 2. Category extraction
  if (lower.includes("sectional")) extractedCategory = "sectional";
  else if (lower.includes("loveseat")) extractedCategory = "loveseat";
  else if (lower.includes("sofa") || lower.includes("couch")) extractedCategory = "sofa";
  else if (lower.includes("recliner")) extractedCategory = "recliner";
  else if (lower.includes("dining")) extractedCategory = "dining";
  else if (lower.includes("bed") || lower.includes("bedroom")) extractedCategory = "bed";
  else if (lower.includes("chair")) extractedCategory = "chair";
  else if (lower.includes("table")) extractedCategory = "table";

  // 3. Material extraction
  if (lower.includes("leather")) extractedMaterial = "leather";
  else if (lower.includes("velvet") || lower.includes("microvelvet")) extractedMaterial = "velvet";
  else if (lower.includes("fabric") || lower.includes("linen")) extractedMaterial = "fabric";
  else if (lower.includes("wood") || lower.includes("hardwood")) extractedMaterial = "wood";

  // 4. Feature extraction
  if (lower.includes("sleeper")) extractedFeatures.push("sleeper");
  if (lower.includes("power") || lower.includes("reclining")) extractedFeatures.push("reclining");
  if (lower.includes("storage")) extractedFeatures.push("storage");
  if (lower.includes("chaise")) extractedFeatures.push("chaise");
  if (lower.includes("pet") || lower.includes("family") || lower.includes("durable")) {
    extractedFeatures.push("fabric");
  }

  return {
    category: extractedCategory,
    maxPrice: extractedMaxPrice,
    material: extractedMaterial,
    features: extractedFeatures,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let {
      category,
      max_price,
      min_price,
      material,
      features = [],
      vendor,
      in_stock_only = true,
      query: naturalQuery,
      limit = 12,
    } = body;

    // Apply natural language intent extraction if conversational query is provided
    if (naturalQuery && typeof naturalQuery === "string") {
      const parsed = parseNaturalQuery(naturalQuery);
      if (!category && parsed.category) category = parsed.category;
      if (!max_price && parsed.maxPrice) max_price = parsed.maxPrice;
      if (!material && parsed.material) material = parsed.material;
      if (parsed.features.length > 0) {
        features = Array.from(new Set([...features, ...parsed.features]));
      }
    }

    // Build Lucene query terms for Shopify Admin GraphQL
    const queryParts: string[] = ["status:active"];

    if (in_stock_only) {
      queryParts.push("inventory_total:>0");
    }

    if (category) {
      const catClean = category.trim();
      queryParts.push(`(product_type:*${catClean}* OR tag:*${catClean}* OR title:*${catClean}*)`);
    }

    if (material) {
      const matClean = material.trim();
      queryParts.push(`(tag:*${matClean}* OR title:*${matClean}*)`);
    }

    if (vendor) {
      queryParts.push(`vendor:*${vendor.trim()}*`);
    }

    if (Array.isArray(features) && features.length > 0) {
      for (const feat of features) {
        if (feat && typeof feat === "string") {
          queryParts.push(`(tag:*${feat.trim()}* OR title:*${feat.trim()}*)`);
        }
      }
    }

    if (typeof max_price === "number" && max_price > 0) {
      queryParts.push(`variants.price:<=${max_price}`);
    }

    if (typeof min_price === "number" && min_price > 0) {
      queryParts.push(`variants.price:>=${min_price}`);
    }

    const compiledQuery = queryParts.join(" AND ");

    const response = await shopifyGraphQL(SEARCH_PRODUCTS_QUERY, {
      query: compiledQuery,
      first: Math.min(25, Math.max(1, limit)),
    });

    if (response.errors && response.errors.length > 0) {
      return NextResponse.json(
        { error: response.errors[0].message, compiledQuery },
        { status: 400 }
      );
    }

    const edges = response.data?.products?.edges || [];
    let products = edges.map((e: any) => normalizeProductSummary(e.node));

    // Post-filter safeguards
    if (typeof max_price === "number" && max_price > 0) {
      products = products.filter((p: any) => p.minPrice <= max_price);
    }
    if (typeof min_price === "number" && min_price > 0) {
      products = products.filter((p: any) => p.minPrice >= min_price);
    }
    if (in_stock_only) {
      products = products.filter((p: any) => p.inStock);
    }

    return NextResponse.json(
      {
        success: true,
        count: products.length,
        queryUsed: compiledQuery,
        filtersApplied: {
          category,
          max_price,
          min_price,
          material,
          features,
          in_stock_only,
        },
        products,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  } catch (error: any) {
    console.error("Search API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to search products" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
