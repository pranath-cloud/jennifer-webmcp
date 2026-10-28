import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_handle = "monika-sleeper-sofa" } = body;

    // AR Model Catalog Mapping for 3D Furniture Visualization
    const arModels: Record<string, { usdzUrl: string; glbUrl: string; scale: string; title: string }> = {
      "monika-sleeper-sofa": {
        title: "Luonto Monika Sleeper Sofa",
        usdzUrl: "https://developer.apple.com/augmented-reality/quick-look/models/retrosca/retrosca.usdz",
        glbUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenCloth/glTF-Binary/SheenCloth.glb",
        scale: "1.0, 1.0, 1.0"
      },
      "mason-leather-89-sofa-1": {
        title: "Mason Leather 89\" Sofa",
        usdzUrl: "https://developer.apple.com/augmented-reality/quick-look/models/retrosca/retrosca.usdz",
        glbUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenCloth/glTF-Binary/SheenCloth.glb",
        scale: "1.0, 1.0, 1.0"
      },
      "kirby-chaise": {
        title: "Kirby Sofa Chaise",
        usdzUrl: "https://developer.apple.com/augmented-reality/quick-look/models/retrosca/retrosca.usdz",
        glbUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenCloth/glTF-Binary/SheenCloth.glb",
        scale: "1.0, 1.0, 1.0"
      }
    };

    const model = arModels[product_handle] || {
      title: "Jennifer Custom Sofa Model",
      usdzUrl: "https://developer.apple.com/augmented-reality/quick-look/models/retrosca/retrosca.usdz",
      glbUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenCloth/glTF-Binary/SheenCloth.glb",
      scale: "1.0, 1.0, 1.0"
    };

    const appleQuickLookUrl = model.usdzUrl;
    const androidSceneViewerUrl = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(model.glbUrl)}&mode=ar_only#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;end;`;

    return NextResponse.json({
      success: true,
      data: {
        productHandle: product_handle,
        title: model.title,
        augmentedReality: {
          iosQuickLookUsdzUrl: appleQuickLookUrl,
          androidSceneViewerUrl: androidSceneViewerUrl,
          directGlbUrl: model.glbUrl,
          instructions: "Open this link on an iPhone (Safari) to launch Apple QuickLook AR, or on Android (Chrome) to place the 3D sofa directly in your living room."
        }
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
