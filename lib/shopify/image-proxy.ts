/**
 * Shopify Image Proxy & Multimodal Base64 Asset Bridge
 * Fetches Shopify CDN images server-side, caches them, and converts to Base64 data URLs
 * for direct ingestion by GPT-4o, DALL-E 3, and MCP Multimodal Vision clients.
 */

const imageCache = new Map<string, string>();

/**
 * Fetches an image URL and returns its base64 data URI (e.g. data:image/jpeg;base64,...)
 */
export async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;

  // Clean URL and ensure high-res variant
  let cleanUrl = imageUrl;
  if (cleanUrl.startsWith("//")) {
    cleanUrl = "https:" + cleanUrl;
  }

  // Check in-memory cache
  if (imageCache.has(cleanUrl)) {
    return imageCache.get(cleanUrl)!;
  }

  try {
    const response = await fetch(cleanUrl, {
      headers: {
        "User-Agent": "JenniferFurniture-WebMCP-VisionBridge/1.0",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      console.warn(`Failed to fetch image from ${cleanUrl}, status: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const base64Data = buffer.toString("base64");
    const dataUri = `data:${contentType};base64,${base64Data}`;

    // Cache up to 100 images
    if (imageCache.size > 100) {
      const firstKey = imageCache.keys().next().value;
      if (firstKey) imageCache.delete(firstKey);
    }
    imageCache.set(cleanUrl, dataUri);

    return dataUri;
  } catch (error) {
    console.error(`Error fetching image ${cleanUrl}:`, error);
    return null;
  }
}

/**
 * Builds an explicit, rigid Geometry Preservation Prompt for vision and diffusion models
 */
export function buildGeometryPreservationPrompt(
  productTitle: string,
  dimensions?: string | null,
  materials?: string | null,
  fabricDetails?: string | null
): string {
  const dimStr = dimensions ? ` (${dimensions})` : "";
  const matStr = materials || fabricDetails ? ` in ${materials || fabricDetails}` : "";

  return (
    `CRITICAL VISUAL IDENTITY INSTRUCTION: Use the supplied ${productTitle}${dimStr}${matStr} ` +
    `reference image as the exact physical product identity. ` +
    `Preserve its precise cushion configuration, back cushion divisions, seat construction, armrest profile/contour, ` +
    `upholstery texture, leg design, and architectural proportions without substituting, altering, or redesigning the furniture. ` +
    `Place this exact product photographically into the customer's room environment.`
  );
}
