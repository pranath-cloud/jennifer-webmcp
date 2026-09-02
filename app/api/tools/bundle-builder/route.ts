import { NextRequest, NextResponse } from "next/server";
import { shopifyGraphQL } from "@/lib/shopify/client";
import { SEARCH_PRODUCTS_QUERY } from "@/lib/shopify/queries";
import { normalizeProductSummary } from "@/lib/shopify/normalizer";
import { generateCartPermalink } from "@/lib/shopify/permalinks";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { base_product_handle = "monika-sleeper-sofa", budget_cap = 3500 } = body;

    // 1. Fetch the Anchor Sofa
    const anchorRes = await shopifyGraphQL<any>(`
      query GetAnchor($handle: String!) {
        productByHandle(handle: $handle) {
          id
          title
          handle
          tags
          totalInventory
          priceRangeV2 { minVariantPrice { amount } }
          featuredImage { url }
          variants(first: 5) {
            edges {
              node {
                id
                title
                price
                availableForSale
              }
            }
          }
        }
      }
    `, { handle: base_product_handle });

    const anchor = anchorRes.data?.productByHandle;
    if (!anchor) {
      return NextResponse.json(
        { success: false, error: `Base product "${base_product_handle}" not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    const anchorPrice = parseFloat(anchor.priceRangeV2?.minVariantPrice?.amount || "0");
    const anchorVariantId = anchor.variants?.edges?.[0]?.node?.id || anchor.id;

    // 2. Fetch Matching Accent Pieces (Ottoman & Chair)
    const searchRes = await shopifyGraphQL<any>(SEARCH_PRODUCTS_QUERY, {
      query: "status:active inventory_total:>0 (product_type:*chair* OR product_type:*ottoman* OR tag:*chair* OR tag:*ottoman*)",
      first: 10,
    });

    const edges = searchRes.data?.products?.edges || [];
    const candidates = edges.map((e: any) => normalizeProductSummary(e.node));

    const ottomans = candidates.filter((p: any) => p.productType?.toLowerCase().includes("ottoman") || p.title?.toLowerCase().includes("ottoman"));
    const chairs = candidates.filter((p: any) => p.productType?.toLowerCase().includes("chair") || p.title?.toLowerCase().includes("chair"));

    const matchingOttoman = ottomans[0] || candidates[0];
    const matchingChair = chairs[0] || candidates[1] || candidates[0];

    const ottomanPrice = matchingOttoman ? matchingOttoman.minPrice : 399.99;
    const chairPrice = matchingChair ? matchingChair.minPrice : 799.99;

    const ottomanVariantId = matchingOttoman?.matchedVariantId || matchingOttoman?.id || "35273545810088";
    const chairVariantId = matchingChair?.matchedVariantId || matchingChair?.id || "35127562436776";

    const totalRetailPrice = anchorPrice + ottomanPrice + chairPrice;
    const discountRate = 0.15; // 15% Bundle Discount
    const bundleSavings = Math.round(totalRetailPrice * discountRate);
    const bundlePrice = totalRetailPrice - bundleSavings;

    // Build 1-Click Multi-Item Cart Permalink
    const bundleItems = [
      { variantId: anchorVariantId, quantity: 1, title: anchor.title, price: anchorPrice },
      { variantId: ottomanVariantId, quantity: 1, title: matchingOttoman?.title || "Coordinated Ottoman", price: ottomanPrice },
      { variantId: chairVariantId, quantity: 1, title: matchingChair?.title || "Matching Accent Chair", price: chairPrice },
    ];

    const permalink = generateCartPermalink(bundleItems, "WEBMCP15");

    return NextResponse.json({
      success: true,
      data: {
        bundleName: `The ${anchor.title.split(" ").slice(0, 3).join(" ")} Coordinated Living Room Suite (3-Piece)`,
        items: [
          {
            role: "Anchor Sofa / Sectional",
            title: anchor.title,
            handle: anchor.handle,
            price: `$${anchorPrice.toFixed(2)}`,
            image: anchor.featuredImage?.url || "",
          },
          {
            role: "Coordinated Ottoman",
            title: matchingOttoman?.title || "Coordinated Storage Ottoman",
            handle: matchingOttoman?.handle || "mazda-ottoman",
            price: `$${ottomanPrice.toFixed(2)}`,
            image: matchingOttoman?.featuredImage || "",
          },
          {
            role: "Matching Accent Chair",
            title: matchingChair?.title || "Matching Designer Accent Chair",
            handle: matchingChair?.handle || "linda-sofa-chair",
            price: `$${chairPrice.toFixed(2)}`,
            image: matchingChair?.featuredImage || "",
          },
        ],
        pricing: {
          regularRetailTotal: `$${totalRetailPrice.toFixed(2)}`,
          bundlePrice: `$${bundlePrice.toFixed(2)}`,
          instantSavings: `$${bundleSavings.toFixed(2)} (15% OFF applied)`,
          withinBudgetCap: bundlePrice <= budget_cap,
        },
        checkout: {
          oneClickBundleCheckoutUrl: permalink.checkoutUrl,
          discountCode: "WEBMCP15",
        },
      },
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Bundle builder error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
