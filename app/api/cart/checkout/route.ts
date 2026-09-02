import { NextRequest, NextResponse } from "next/server";
import { generateCartPermalink } from "@/lib/shopify/permalinks";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items = [], discount_code, note } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required parameter: items (array of { variant_id, quantity })" },
        { status: 400 }
      );
    }

    const formattedItems = items.map((item: any) => ({
      variantId: String(item.variant_id || item.variantId || ""),
      quantity: Number(item.quantity || 1),
      title: item.title,
      price: Number(item.price || 0),
    }));

    // Verify all items have variant IDs
    const invalid = formattedItems.find((i) => !i.variantId);
    if (invalid) {
      return NextResponse.json(
        { error: "Each item in items array must contain a valid variant_id" },
        { status: 400 }
      );
    }

    const handoff = generateCartPermalink(formattedItems, discount_code, note);

    return NextResponse.json({
      success: true,
      data: handoff,
    });
  } catch (error: any) {
    console.error("Checkout API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate checkout handoff" },
      { status: 500 }
    );
  }
}
