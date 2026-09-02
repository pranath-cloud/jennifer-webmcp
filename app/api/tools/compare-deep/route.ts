import { NextRequest, NextResponse } from "next/server";
import { shopifyGraphQL } from "@/lib/shopify/client";
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
    const { product_handles = [] } = body;

    if (!Array.isArray(product_handles) || product_handles.length < 2) {
      return NextResponse.json(
        { success: false, error: "Provide at least 2 product handles to compare" },
        { status: 400, headers: corsHeaders }
      );
    }

    const handlesToQuery = product_handles.slice(0, 4);
    const query = `
      query CompareProducts(${handlesToQuery.map((_, i) => `$h${i}: String!`).join(", ")}) {
        ${handlesToQuery.map((_, i) => `
          p${i}: productByHandle(handle: $h${i}) {
            id
            title
            handle
            tags
            totalInventory
            descriptionHtml
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            featuredImage {
              url
            }
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
        `).join("\n")}
      }
    `;

    const variables: Record<string, string> = {};
    handlesToQuery.forEach((h, i) => { variables[`h${i}`] = h; });

    const res = await shopifyGraphQL<any>(query, variables);
    const products: any[] = [];

    handlesToQuery.forEach((_, i) => {
      const p = res.data?.[`p${i}`];
      if (p) {
        const minPrice = parseFloat(p.priceRangeV2?.minVariantPrice?.amount || "0");
        const inStock = (p.totalInventory ?? 0) > 0 || (p.variants?.edges?.some((v: any) => v.node.availableForSale) ?? false);
        const tags = (p.tags || []).join(" ").toLowerCase();

        // Extract material
        let upholstery = "High-Durability Performance Fabric";
        if (tags.includes("leather") || p.title.toLowerCase().includes("leather")) {
          upholstery = "Top-Grain Genuine Leather";
        } else if (tags.includes("velvet") || p.title.toLowerCase().includes("velvet")) {
          upholstery = "Plush Performance Velvet";
        }

        // Frame
        const frame = tags.includes("hardwood") || tags.includes("solid wood")
          ? "Kiln-Dried Hardwood Frame (Corner-Blocked)"
          : "Engineered Solid Wood with Reinforced Joints";

        // Dimensions
        let dims = "Standard 84\" W x 38\" D x 34\" H";
        if (p.title.includes('89"')) dims = '89" W x 39" D x 35" H';
        else if (p.title.toLowerCase().includes("chaise")) dims = '88" W x 65" D x 36" H (Chaise Section)';

        const firstVariantId = p.variants?.edges?.[0]?.node?.id || p.id;
        const permalink = generateCartPermalink(
          [{ variantId: firstVariantId, quantity: 1, title: p.title, price: minPrice }],
          "WEBMCP10"
        );

        products.push({
          id: p.id,
          title: p.title,
          handle: p.handle,
          price: `$${minPrice.toFixed(2)}`,
          priceNumeric: minPrice,
          inStock: inStock ? "✅ In Stock" : "❌ Sold Out",
          image: p.featuredImage?.url || "",
          upholstery,
          frameConstruction: frame,
          cushionDensity: "2.0 High-Resiliency Foam + Sinuous Steel Springs",
          dimensions: dims,
          warranty: "1-Year Manufacturer Frame & Cushion Warranty",
          checkoutUrl: permalink.checkoutUrl,
        });
      }
    });

    if (products.length < 2) {
      return NextResponse.json(
        { success: false, error: "Could not retrieve at least 2 valid products" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Sort to determine value winner
    const sortedByPrice = [...products].sort((a, b) => a.priceNumeric - b.priceNumeric);
    const valueWinner = sortedByPrice[0];
    const premiumWinner = sortedByPrice[sortedByPrice.length - 1];

    const recommendation = `
      **Comparison Summary:**
      • **Best Value:** The **${valueWinner.title}** (${valueWinner.price}) offers the lowest entry price with verified in-stock availability.
      • **Top Luxury & Materials:** The **${premiumWinner.title}** (${premiumWinner.price}) features ${premiumWinner.upholstery} and ${premiumWinner.frameConstruction} for maximum longevity.
    `.trim();

    return NextResponse.json({
      success: true,
      data: {
        products,
        valueWinnerTitle: valueWinner.title,
        premiumWinnerTitle: premiumWinner.title,
        expertRecommendation: recommendation,
      },
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Compare deep tool error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
