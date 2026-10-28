import { NextRequest, NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Session, X-Shop-Domain, *",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

export async function POST(request: NextRequest) {
  try {
    let base64Audio = "";
    let mimeType = "audio/webm";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const json = await request.json();
      base64Audio = json.audio || "";
      mimeType = json.mimeType || mimeType;
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as Blob;
      if (file) {
        mimeType = file.type || mimeType;
        const arrayBuffer = await file.arrayBuffer();
        base64Audio = Buffer.from(arrayBuffer).toString("base64");
      }
    } else {
      const arrayBuffer = await request.arrayBuffer();
      if (arrayBuffer.byteLength > 0) {
        base64Audio = Buffer.from(arrayBuffer).toString("base64");
        mimeType = contentType || mimeType;
      }
    }

    if (!base64Audio || base64Audio.length < 10) {
      return NextResponse.json(
        { success: false, error: "No audio data provided" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (base64Audio.includes(",")) {
      const parts = base64Audio.split(",");
      base64Audio = parts[1];
    }

    if (!OPENROUTER_KEY) {
      return NextResponse.json({ success: false, error: "OPENROUTER_API_KEY env var is not set" }, { status: 500 });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://webmcp.tendrilsioservices.com",
        "X-Title": "Jennifer Furniture Audio Transcriber",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe the following user audio verbatim into clear English text. The user is talking to a luxury furniture AI assistant. Capture room dimensions (e.g. 15x12 ft, 400 cm x 350 cm), prices, colors (blue, cognac, grey, brown), furniture categories (sofa, recliner, study table, dining set), and customer intent precisely. Return ONLY the exact transcribed text string without quotes or extra words.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Audio}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter Audio Transcribe error:", response.status, errText);
      return NextResponse.json(
        { success: false, error: `Transcription API error: ${response.status}` },
        { status: 500, headers: corsHeaders }
      );
    }

    const data = await response.json();
    let transcribedText = data.choices?.[0]?.message?.content?.trim() || "";
    transcribedText = transcribedText.replace(/^["']|["']$/g, "").trim();

    return NextResponse.json(
      {
        success: true,
        text: transcribedText,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("Audio transcription error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to transcribe audio" },
      { status: 500, headers: corsHeaders }
    );
  }
}
