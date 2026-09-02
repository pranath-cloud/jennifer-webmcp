import { NextRequest, NextResponse } from "next/server";
import { shopifyGraphQL } from "@/lib/shopify/client";
import { GET_PRODUCT_DETAILS_QUERY, SEARCH_PRODUCTS_QUERY } from "@/lib/shopify/queries";
import { normalizeProductDetailed } from "@/lib/shopify/normalizer";
import { fetchImageAsBase64, buildGeometryPreservationPrompt } from "@/lib/shopify/image-proxy";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_id, handle } = body;

    let targetGid = product_id;

    // If handle is provided instead of GID, lookup GID by handle
    if (!targetGid && handle) {
      const searchRes = await shopifyGraphQL(SEARCH_PRODUCTS_QUERY, {
        query: `handle:${handle.trim()}`,
        first: 1,
      });
      const firstEdge = searchRes.data?.products?.edges?.[0];
      if (firstEdge) {
        targetGid = firstEdge.node.id;
      }
    }

    if (!targetGid) {
      return NextResponse.json(
        { error: "Missing required parameter: product_id or handle" },
        { status: 400 }
      );
    }

    // Format GID if raw numeric ID was passed
    if (!targetGid.startsWith("gid://")) {
      targetGid = `gid://shopify/Product/${targetGid}`;
    }

    const response = await shopifyGraphQL(GET_PRODUCT_DETAILS_QUERY, {
      id: targetGid,
    });

    if (response.errors && response.errors.length > 0) {
      return NextResponse.json(
        { error: response.errors[0].message },
        { status: 400 }
      );
    }

    const productNode = response.data?.product;
    if (!productNode) {
      return NextResponse.json(
        { error: `Product not found with ID: ${targetGid}` },
        { status: 404 }
      );
    }

    const detailedProduct = normalizeProductDetailed(productNode);

    // Fetch primary canonical base64 visual asset
    const canonicalImage =
      detailedProduct.images?.find((img: any) => img.imageRole === "canonical_product_view") ||
      detailedProduct.images?.[0] ||
      (detailedProduct.featuredImage ? { url: detailedProduct.featuredImage, altText: detailedProduct.title } : null);

    let imageBase64: string | null = null;
    if (canonicalImage?.url) {
      imageBase64 = await fetchImageAsBase64(canonicalImage.url);
    }

    const geometryPreservationPrompt = buildGeometryPreservationPrompt(
      detailedProduct.title,
      detailedProduct.specifications.dimensions,
      detailedProduct.specifications.materials,
      detailedProduct.specifications.fabricDetails
    );

    return NextResponse.json({
      success: true,
      product: detailedProduct,
      primaryVisualAsset: {
        canonicalUrl: canonicalImage?.url || null,
        imageBase64,
        imageRole: "canonical_product_view",
        geometryPreservationPrompt,
      },
    });
  } catch (error: any) {
    console.error("Details API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch product details" },
      { status: 500 }
    );
  }
}
