import { NextRequest, NextResponse } from "next/server";
import { getStoreById, saveStore, deleteStore } from "@/lib/tenants/registry";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, *",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const store = getStoreById(id);
  if (!store) {
    return NextResponse.json({ success: false, error: "Store not found" }, { status: 404, headers: corsHeaders });
  }
  return NextResponse.json({ success: true, store }, { headers: corsHeaders });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const existing = getStoreById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Store not found" }, { status: 404, headers: corsHeaders });
    }

    const updated = saveStore({
      ...existing,
      ...body,
      id: existing.id, // Preserve ID
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, store: updated }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const ok = deleteStore(id);
    if (!ok) {
      return NextResponse.json({ success: false, error: "Cannot delete default store or store not found" }, { status: 400, headers: corsHeaders });
    }
    return NextResponse.json({ success: true, message: `Store ${id} deleted` }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}