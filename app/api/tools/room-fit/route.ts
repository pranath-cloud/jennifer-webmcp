import { NextRequest, NextResponse } from "next/server";
import { shopifyGraphQL } from "@/lib/shopify/client";
import { GET_PRODUCT_DETAILS_QUERY } from "@/lib/shopify/queries";
import { normalizeProductDetailed } from "@/lib/shopify/normalizer";

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
    const {
      room_width_feet = 12,
      room_length_feet = 10,
      product_handle,
      include_coffee_table = true,
    } = body;

    if (!product_handle) {
      return NextResponse.json(
        { success: false, error: "product_handle is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Query Shopify for product specifications
    const res = await shopifyGraphQL<any>(`
      query GetProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id
          title
          handle
          descriptionHtml
          tags
          totalInventory
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          featuredImage {
            url
          }
          variants(first: 10) {
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
    `, { handle: product_handle });

    const prod = res.data?.productByHandle;
    if (!prod) {
      return NextResponse.json(
        { success: false, error: `Product "${product_handle}" not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    // Extract width and depth in inches (defaults based on standard dimensions or title tags)
    let sofaWidthInches = 84;
    let sofaDepthInches = 38;

    const tags = prod.tags || [];
    const widthTag = tags.find((t: string) => /\b\d{2,3}["']?\s*(?:w|width)\b/i.test(t) || /\b\d{2,3}"\b/.test(t));
    if (widthTag) {
      const match = widthTag.match(/(\d{2,3})/);
      if (match) sofaWidthInches = parseInt(match[1]);
    } else if (prod.title.includes('89"')) {
      sofaWidthInches = 89;
    } else if (prod.title.includes('94"')) {
      sofaWidthInches = 94;
    } else if (prod.title.toLowerCase().includes("sectional")) {
      sofaWidthInches = 108;
      sofaDepthInches = 68; // with chaise
    }

    const roomWidthInches = room_width_feet * 12;
    const roomLengthInches = room_length_feet * 12;

    const remainingWidthInches = roomWidthInches - sofaWidthInches;
    const sideClearanceEach = Math.max(0, Math.round(remainingWidthInches / 2));

    const coffeeTableDepth = include_coffee_table ? 24 : 0;
    const coffeeTableGap = include_coffee_table ? 16 : 0; // standard 16" between sofa & coffee table
    const frontOccupiedInches = sofaDepthInches + coffeeTableDepth + coffeeTableGap;
    const frontWalkwayClearanceInches = Math.max(0, Math.round(roomLengthInches - frontOccupiedInches));

    // Standard walkway minimum is 30-36 inches
    let verdict: "EXCELLENT_FIT" | "MODERATE_FIT" | "TIGHT_FIT" = "EXCELLENT_FIT";
    let score = 95;
    let feedback = "";

    if (frontWalkwayClearanceInches < 24 || sideClearanceEach < 18) {
      verdict = "TIGHT_FIT";
      score = 60;
      feedback = `Tight fit: You have only ${frontWalkwayClearanceInches}" of front walkway clearance (recommended minimum is 30"). Consider a smaller sofa or removing the coffee table.`;
    } else if (frontWalkwayClearanceInches < 36 || sideClearanceEach < 24) {
      verdict = "MODERATE_FIT";
      score = 80;
      feedback = `Comfortable fit: You have ${frontWalkwayClearanceInches}" of front clearance and ${sideClearanceEach}" on the sides, giving adequate walking space.`;
    } else {
      verdict = "EXCELLENT_FIT";
      score = 98;
      feedback = `Spacious luxury fit: You have ${frontWalkwayClearanceInches}" of front clearance and ${sideClearanceEach}" on the sides, allowing unrestricted movement and room for end tables.`;
    }

    return NextResponse.json({
      success: true,
      data: {
        product: {
          title: prod.title,
          handle: prod.handle,
          sofaDimensions: `${sofaWidthInches}" W x ${sofaDepthInches}" D`,
          price: parseFloat(prod.priceRangeV2?.minVariantPrice?.amount || "0"),
        },
        room: {
          dimensions: `${room_width_feet} ft x ${room_length_feet} ft (${roomWidthInches}" x ${roomLengthInches}")`,
          includeCoffeeTable: include_coffee_table,
        },
        clearanceAnalysis: {
          verdict,
          fitScore: score,
          sideClearanceLeftRightInches: sideClearanceEach,
          frontWalkwayClearanceInches,
          recommendedClearanceMinInches: 30,
          expertFeedback: feedback,
        },
      },
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Room fit tool error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
