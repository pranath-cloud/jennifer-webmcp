import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      room_width_feet = 14,
      room_length_feet = 12,
      product_title = "Luonto Monika Sleeper Sofa",
      sofa_width_inches = 84,
      sofa_depth_inches = 38,
      include_coffee_table = true,
      include_walkway_indicators = true
    } = body;

    // Convert room dimensions to inches (1 ft = 12 in)
    const roomWIn = room_width_feet * 12;
    const roomLIn = room_length_feet * 12;

    // SVG Canvas mapping: scale factor 4px per inch
    const scale = 3.5;
    const canvasW = Math.round(roomWIn * scale) + 120; // 60px padding on each side
    const canvasH = Math.round(roomLIn * scale) + 120;
    const offsetX = 60;
    const offsetY = 60;

    const roomSvgW = Math.round(roomWIn * scale);
    const roomSvgH = Math.round(roomLIn * scale);

    // Sofa dimensions in SVG px
    const sofaSvgW = Math.round(sofa_width_inches * scale);
    const sofaSvgD = Math.round(sofa_depth_inches * scale);

    // Centered Sofa Placement against back wall (18" from top wall)
    const sofaX = offsetX + Math.round((roomSvgW - sofaSvgW) / 2);
    const sofaY = offsetY + Math.round(18 * scale);

    // Coffee table dimensions (48" x 24") positioned 18" in front of sofa
    const ctW = Math.round(48 * scale);
    const ctD = Math.round(24 * scale);
    const ctX = offsetX + Math.round((roomSvgW - ctW) / 2);
    const ctY = sofaY + sofaSvgD + Math.round(18 * scale);

    // Clearance Calculations
    const leftMarginIn = Math.round((roomWIn - sofa_width_inches) / 2);
    const rightMarginIn = leftMarginIn;
    const frontWalkwayIn = roomLIn - (18 + sofa_depth_inches + (include_coffee_table ? 18 + 24 : 0));

    // Generate Architectural 2D SVG
    const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}" width="100%" height="100%" style="background:#0f172a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,monospace; border-radius:12px;">
  <!-- Grid Blueprint Pattern -->
  <defs>
    <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
      <path d="M 42 0 L 0 0 0 42" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    </pattern>
    <linearGradient id="sofaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="ctGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
  </defs>

  <rect width="100%" height="100%" fill="url(#grid)" />

  <!-- Room Walls (Perimeter) -->
  <rect x="${offsetX}" y="${offsetY}" width="${roomSvgW}" height="${roomSvgH}" fill="rgba(30, 41, 59, 0.7)" stroke="#38bdf8" stroke-width="4" rx="4" />
  
  <!-- Door Swing Indicator (Bottom Right) -->
  <path d="M ${offsetX + roomSvgW - 50} ${offsetY + roomSvgH} A 50 50 0 0 1 ${offsetX + roomSvgW} ${offsetY + roomSvgH - 50}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4" />
  <line x1="${offsetX + roomSvgW - 50}" y1="${offsetY + roomSvgH}" x2="${offsetX + roomSvgW}" y2="${offsetY + roomSvgH}" stroke="#94a3b8" stroke-width="3" />

  <!-- Dimension Labels: Top Wall Width -->
  <text x="${offsetX + roomSvgW / 2}" y="${offsetY - 18}" fill="#38bdf8" font-size="14" font-weight="700" text-anchor="middle">
    ↔ ${room_width_feet} ft (${roomWIn}") Wall Width
  </text>
  
  <!-- Dimension Labels: Left Wall Length -->
  <text x="${offsetX - 20}" y="${offsetY + roomSvgH / 2}" fill="#38bdf8" font-size="14" font-weight="700" text-anchor="middle" transform="rotate(-90 ${offsetX - 20} ${offsetY + roomSvgH / 2})">
    ↔ ${room_length_feet} ft (${roomLIn}") Wall Length
  </text>

  <!-- Sofa Representation -->
  <rect x="${sofaX}" y="${sofaY}" width="${sofaSvgW}" height="${sofaSvgD}" fill="url(#sofaGrad)" stroke="#60a5fa" stroke-width="2" rx="8" />
  
  <!-- Sofa Cushions Detail -->
  <rect x="${sofaX + 6}" y="${sofaY + 6}" width="${sofaSvgW / 2 - 9}" height="${sofaSvgD - 16}" fill="rgba(255,255,255,0.12)" rx="4" />
  <rect x="${sofaX + sofaSvgW / 2 + 3}" y="${sofaY + 6}" width="${sofaSvgW / 2 - 9}" height="${sofaSvgD - 16}" fill="rgba(255,255,255,0.12)" rx="4" />
  
  <!-- Sofa Text -->
  <text x="${sofaX + sofaSvgW / 2}" y="${sofaY + sofaSvgD / 2 + 5}" fill="#ffffff" font-size="13" font-weight="700" text-anchor="middle">
    🛋️ ${product_title.slice(0, 24)} (${sofa_width_inches}" × ${sofa_depth_inches}")
  </text>

  <!-- Left/Right Walking Clearance Indicators -->
  <line x1="${offsetX}" y1="${sofaY + sofaSvgD / 2}" x2="${sofaX}" y2="${sofaY + sofaSvgD / 2}" stroke="#a855f7" stroke-width="2" stroke-dasharray="4" />
  <text x="${offsetX + (sofaX - offsetX) / 2}" y="${sofaY + sofaSvgD / 2 - 6}" fill="#c084fc" font-size="11" font-weight="600" text-anchor="middle">${leftMarginIn}" Clearance</text>

  <line x1="${sofaX + sofaSvgW}" y1="${sofaY + sofaSvgD / 2}" x2="${offsetX + roomSvgW}" y2="${sofaY + sofaSvgD / 2}" stroke="#a855f7" stroke-width="2" stroke-dasharray="4" />
  <text x="${sofaX + sofaSvgW + (offsetX + roomSvgW - sofaX - sofaSvgW) / 2}" y="${sofaY + sofaSvgD / 2 - 6}" fill="#c084fc" font-size="11" font-weight="600" text-anchor="middle">${rightMarginIn}" Clearance</text>

  ${include_coffee_table ? `
  <!-- Coffee Table Representation -->
  <rect x="${ctX}" y="${ctY}" width="${ctW}" height="${ctD}" fill="url(#ctGrad)" stroke="#34d399" stroke-width="2" rx="6" />
  <text x="${ctX + ctW / 2}" y="${ctY + ctD / 2 + 4}" fill="#ffffff" font-size="11" font-weight="600" text-anchor="middle">☕ Coffee Table (48" × 24")</text>
  ` : ''}

  <!-- Front Walking Path -->
  <rect x="${offsetX + 20}" y="${offsetY + roomSvgH - Math.round(frontWalkwayIn * scale)}" width="${roomSvgW - 40}" height="${Math.round(frontWalkwayIn * scale)}" fill="rgba(34, 197, 94, 0.08)" stroke="#22c55e" stroke-width="1" stroke-dasharray="6" rx="4" />
  <text x="${offsetX + roomSvgW / 2}" y="${offsetY + roomSvgH - 18}" fill="#4ade80" font-size="12" font-weight="700" text-anchor="middle">
    🚶 Front Walkway Clearance: ${frontWalkwayIn}" (Standard minimum: 30")
  </text>
</svg>`.trim();

    return NextResponse.json({
      success: true,
      data: {
        room: {
          widthFeet: room_width_feet,
          lengthFeet: room_length_feet,
          areaSqFt: room_width_feet * room_length_feet
        },
        product: {
          title: product_title,
          widthInches: sofa_width_inches,
          depthInches: sofa_depth_inches
        },
        clearances: {
          leftSideClearanceInches: leftMarginIn,
          rightSideClearanceInches: rightMarginIn,
          frontWalkwayClearanceInches: frontWalkwayIn,
          verdict: frontWalkwayIn >= 30 ? "SPACIOUS_FIT" : "TIGHT_FIT",
          fitScore: Math.min(100, Math.round(50 + (frontWalkwayIn / 60) * 50))
        },
        svgDiagram: svgContent,
        svgDataUri: `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`
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
