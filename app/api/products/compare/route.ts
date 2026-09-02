import { NextRequest, NextResponse } from "next/server";
import { shopifyGraphQL } from "@/lib/shopify/client";
import { GET_PRODUCTS_BY_IDS_QUERY } from "@/lib/shopify/queries";
import { normalizeProductDetailed, buildComparisonMatrix } from "@/lib/shopify/normalizer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_ids = [] } = body;

    if (!Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json(
        { error: "Missing required parameter: product_ids (array of 2 to 4 product IDs)" },
        { status: 400 }
      );
    }

    const formattedGids = product_ids.slice(0, 4).map((id: string) => {
      if (typeof id === "string" && !id.startsWith("gid://")) {
        return `gid://shopify/Product/${id}`;
      }
      return id;
    });

    const response = await shopifyGraphQL(GET_PRODUCTS_BY_IDS_QUERY, {
      ids: formattedGids,
    });

    if (response.errors && response.errors.length > 0) {
      return NextResponse.json(
        { error: response.errors[0].message },
        { status: 400 }
      );
    }

    const nodes = (response.data?.nodes || []).filter(Boolean);
    const detailedProducts = nodes.map((node: any) => normalizeProductDetailed(node));
    const comparison = buildComparisonMatrix(detailedProducts);

    return NextResponse.json({
      success: true,
      data: comparison,
    });
  } catch (error: any) {
    console.error("Compare API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to compare products" },
      { status: 500 }
    );
  }
}
