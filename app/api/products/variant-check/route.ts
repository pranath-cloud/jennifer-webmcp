import { NextRequest, NextResponse } from "next/server";
import { shopifyGraphQL } from "@/lib/shopify/client";
import { GET_PRODUCT_DETAILS_QUERY } from "@/lib/shopify/queries";
import { VariantCheckResult } from "@/lib/types/shopify";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_id, selected_options = {} } = body;

    if (!product_id) {
      return NextResponse.json(
        { error: "Missing required parameter: product_id" },
        { status: 400 }
      );
    }

    let targetGid = product_id;
    if (!targetGid.startsWith("gid://")) {
      targetGid = `gid://shopify/Product/${targetGid}`;
    }

    const response = await shopifyGraphQL(GET_PRODUCT_DETAILS_QUERY, {
      id: targetGid,
    });

    const productNode = response.data?.product;
    if (!productNode) {
      return NextResponse.json(
        { error: `Product not found with ID: ${targetGid}` },
        { status: 404 }
      );
    }

    const variantEdges = productNode.variants?.edges || [];
    const inStockVariants = variantEdges
      .map((e: any) => e.node)
      .filter((v: any) => v.inventoryQuantity > 0 || v.availableForSale);

    // Normalize keys in requested options
    const normalizedReq: Record<string, string> = {};
    for (const [k, v] of Object.entries(selected_options)) {
      normalizedReq[k.toLowerCase().trim()] = String(v).toLowerCase().trim();
    }

    // Try to find an exact matching variant
    let matchedVariant = variantEdges.map((e: any) => e.node).find((v: any) => {
      const selected = v.selectedOptions || [];
      return Object.entries(normalizedReq).every(([reqKey, reqVal]) => {
        return selected.some((s: any) => {
          const nameMatch = s.name.toLowerCase().includes(reqKey) || reqKey.includes(s.name.toLowerCase());
          const valMatch = s.value.toLowerCase().includes(reqVal) || reqVal.includes(s.value.toLowerCase());
          return nameMatch && valMatch;
        });
      });
    });

    // If no exact match on all options, try fuzzy match on title or any option
    if (!matchedVariant && Object.keys(normalizedReq).length > 0) {
      const reqValues = Object.values(normalizedReq);
      matchedVariant = variantEdges.map((e: any) => e.node).find((v: any) => {
        const vTitle = v.title.toLowerCase();
        return reqValues.some((val) => vTitle.includes(val));
      });
    }

    // If still none, default to first in-stock variant if available
    if (!matchedVariant && inStockVariants.length > 0) {
      matchedVariant = inStockVariants[0];
    } else if (!matchedVariant && variantEdges.length > 0) {
      matchedVariant = variantEdges[0].node;
    }

    const isAvailable = matchedVariant
      ? (matchedVariant.inventoryQuantity > 0 || matchedVariant.availableForSale)
      : false;

    const result: VariantCheckResult = {
      productId: productNode.id,
      productTitle: productNode.title,
      requestedOptions: selected_options,
      isAvailable,
      matchedVariant: matchedVariant
        ? {
            id: matchedVariant.id,
            title: matchedVariant.title,
            sku: matchedVariant.sku || "",
            price: parseFloat(matchedVariant.price),
            inventoryQuantity: matchedVariant.inventoryQuantity ?? 0,
            availableForSale: matchedVariant.availableForSale ?? true,
          }
        : null,
      allVariantsInStock: inStockVariants.map((v: any) => ({
        id: v.id,
        title: v.title,
        price: parseFloat(v.price),
        inventoryQuantity: v.inventoryQuantity ?? 0,
      })),
      message: isAvailable
        ? `Option "${matchedVariant?.title}" is in stock and available for immediate shipping (Stock: ${matchedVariant?.inventoryQuantity}).`
        : `Requested combination is currently out of stock. Alternative in-stock options: ${inStockVariants.map((v: any) => v.title).join(", ") || "None"}`,
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Variant Check API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check variant availability" },
      { status: 500 }
    );
  }
}
