import { NextRequest, NextResponse } from "next/server";
import { validateAdminCredentials, generateAdminSessionToken } from "@/lib/auth/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, admin_key } = body;

    const keyToTest = password || admin_key;

    if (!validateAdminCredentials(keyToTest)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid admin password or key. Access denied.",
        },
        { status: 401 }
      );
    }

    const token = generateAdminSessionToken();

    return NextResponse.json({
      success: true,
      message: "Admin authentication successful. Executive Store BI tools unlocked.",
      sessionToken: token,
      role: "admin",
      unlockedTools: [
        "get_store_revenue_and_analytics",
        "get_inventory_health_and_restock_alerts",
        "analyze_customer_behavior_and_trends",
      ],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
