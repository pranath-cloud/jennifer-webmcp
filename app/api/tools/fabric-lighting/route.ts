import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      wall_color = "warm beige",
      window_exposure = "South-Facing (Warm Bright Light)",
      flooring_type = "Light Hardwood",
      household_profile = "Family with Kids & Pets"
    } = body;

    const lowerWall = wall_color.toLowerCase();
    const lowerExp = window_exposure.toLowerCase();

    // Fabric Harmonization Logic
    const recommendedPalettes = [];

    if (lowerWall.includes("beige") || lowerWall.includes("cream") || lowerWall.includes("white")) {
      recommendedPalettes.push({
        materialType: "Top-Grain Cognac Genuine Leather",
        swatchHex: "#8B4513",
        styleRole: "Warm Contrast Anchor",
        durabilityScore: "10/10 (High Resiliency, Pet Friendly)",
        lightingInteraction: "South-facing natural light enhances the rich amber patina of genuine leather without fading.",
        suggestedProductHandles: ["mason-leather-89-sofa-1", "marshall-avenue-reclining-sofa"]
      });
      recommendedPalettes.push({
        materialType: "Charcoal Textured Performance Weave",
        swatchHex: "#334155",
        styleRole: "Modern Architectural Accent",
        durabilityScore: "9/10 (Stain Resistant Hydrophobic Coating)",
        lightingInteraction: "Neutralizes excessive warm daylight, preventing glare while creating grounded visual weight.",
        suggestedProductHandles: ["monika-sleeper-sofa", "kirby-chaise"]
      });
    } else if (lowerWall.includes("grey") || lowerWall.includes("gray") || lowerWall.includes("blue") || lowerWall.includes("navy")) {
      recommendedPalettes.push({
        materialType: "Ivory Bouclé / Micro-Chenille",
        swatchHex: "#F8FAFC",
        styleRole: "Luminous Softening Tone",
        durabilityScore: "8.5/10 (High Rub Count Polyester Blend)",
        lightingInteraction: "Bounces ambient daylight across cooler room palettes, adding coziness and organic texture.",
        suggestedProductHandles: ["stacey-sofa", "linda-sofa-chair"]
      });
      recommendedPalettes.push({
        materialType: "Emerald Velvet / Jewel Tone",
        swatchHex: "#065F46",
        styleRole: "Luxury Focal Centerpiece",
        durabilityScore: "8/10 (Dense Pile Velvet)",
        lightingInteraction: "Reflects deep jewel undertones under warm evening lighting.",
        suggestedProductHandles: ["monika-sleeper-sofa"]
      });
    } else {
      recommendedPalettes.push({
        materialType: "Oatmeal Performance Linen",
        swatchHex: "#E2E8F0",
        styleRole: "Universal Organic Neutral",
        durabilityScore: "9.5/10 (Bleach-Cleanable Crypton Fabric)",
        lightingInteraction: "Adapts dynamically across both morning cool light and afternoon warm sun.",
        suggestedProductHandles: ["monika-sleeper-sofa", "stacey-sofa"]
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        roomContext: {
          wallColor: wall_color,
          windowExposure: window_exposure,
          flooring: flooring_type,
          householdProfile: household_profile
        },
        designerVerdict: "HARMONIZED_MATCH",
        paletteRecommendations: recommendedPalettes,
        maintenanceTip: "For South & West facing rooms, apply UV fabric protection spray to prevent gradual discoloration."
      }
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
