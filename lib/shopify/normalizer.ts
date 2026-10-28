import * as cheerio from "cheerio";
import {
  ProductSummary,
  ProductDetailed,
  ProductVariant,
  ProductOption,
  ProductComparisonMatrix,
} from "@/lib/types/shopify";

export function cleanHtmlText(html: string | null | undefined): string {
  if (!html) return "";
  try {
    const $ = cheerio.load(html);
    // Remove script and style tags
    $("script, style").remove();
    return $.text().replace(/\s+/g, " ").trim();
  } catch {
    return html.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
  }
}

export function extractDimensions(text: string, metafields: any[] = []): string {
  // Check metafields first
  const lengthMeta = metafields.find(
    (m) => m.key === "length" || m.key === "dimensions" || m.key === "sofa_size"
  );
  if (lengthMeta && lengthMeta.value) {
    return String(lengthMeta.value);
  }

  // Regex extract dimensions from description
  const dimensionRegex = /(?:dimensions?|size|measures?):\s*([^.\n<]+)/i;
  const match = text.match(dimensionRegex);
  if (match && match[1]) {
    return match[1].trim();
  }

  const dimensionPattern = /(\d+(?:\.\d+)?["'\s]*(?:W|width|L|length|D|depth|H|height|x|X)\s*\d+(?:\.\d+)?["'\s]*(?:W|width|L|length|D|depth|H|height|x|X)?\s*\d*(?:\.\d+)?["'\s]*(?:H|height)?)/i;
  const dimMatch = text.match(dimensionPattern);
  if (dimMatch && dimMatch[1]) {
    return dimMatch[1].trim();
  }

  return "Standard Full Configuration (Contact for custom room fit)";
}

export function extractMaterial(tags: string[], text: string, metafields: any[] = []): string {
  const fabricMeta = metafields.find((m) => m.key === "fabric" || m.key === "leather");
  if (fabricMeta && fabricMeta.value) {
    return cleanHtmlText(String(fabricMeta.value));
  }

  const materialTags = tags.filter((t) => t.toLowerCase().startsWith("material-"));
  if (materialTags.length > 0) {
    return materialTags.map((t) => t.replace(/^material-/i, "")).join(", ");
  }

  const lowerText = text.toLowerCase();
  if (lowerText.includes("top grain leather") || lowerText.includes("genuine leather")) {
    return "Top Grain Genuine Leather";
  }
  if (lowerText.includes("leather")) {
    return "Premium Leather";
  }
  if (lowerText.includes("velvet") || lowerText.includes("microvelvet")) {
    return "Soft Microvelvet / Performance Velvet";
  }
  if (lowerText.includes("linen")) {
    return "Linen-Blend Fabric";
  }
  if (lowerText.includes("chenille")) {
    return "Plush Chenille Fabric";
  }
  if (lowerText.includes("solid wood")) {
    return "Solid Hardwood Construction";
  }

  return "High-Durability Performance Fabric";
}

export function normalizeProductSummary(node: any): ProductSummary {
  const minPrice = parseFloat(
    node.priceRangeV2?.minVariantPrice?.amount || "0"
  );
  const maxPrice = parseFloat(
    node.priceRangeV2?.maxVariantPrice?.amount || "0"
  );
  const currency =
    node.priceRangeV2?.minVariantPrice?.currencyCode || "USD";

  const colorOption = node.options?.find(
    (o: any) => o.name.toLowerCase() === "color" || o.name.toLowerCase() === "finish"
  );
  const materialOption = node.options?.find(
    (o: any) => o.name.toLowerCase() === "material" || o.name.toLowerCase() === "fabric" || o.name.toLowerCase() === "upholstery"
  );
  const sizeOption = node.options?.find(
    (o: any) => o.name.toLowerCase() === "size" || o.name.toLowerCase() === "configuration"
  );

  const optionColors: string[] = colorOption ? colorOption.values : [];
  const optionMaterials: string[] = materialOption ? materialOption.values : [];
  const availableSizes: string[] = sizeOption ? sizeOption.values : [];

  const variantColors: string[] = (node.variants?.edges || []).flatMap((v: any) => 
    (v.node?.selectedOptions || [])
      .filter((so: any) => so.name && (so.name.toLowerCase() === "color" || so.name.toLowerCase() === "finish"))
      .map((so: any) => so.value)
  );
  const variantMaterials: string[] = (node.variants?.edges || []).flatMap((v: any) => 
    (v.node?.selectedOptions || [])
      .filter((so: any) => so.name && (so.name.toLowerCase() === "material" || so.name.toLowerCase() === "fabric" || so.name.toLowerCase() === "upholstery"))
      .map((so: any) => so.value)
  );

  const metafieldNodes: any[] = node.metafields?.edges?.map((e: any) => e.node) || [];
  const collections: string[] = node.collections?.edges?.map((e: any) => e.node.title) || [];

  function parseMetaList(metaKeySubstrings: string[]): string[] {
    const results: string[] = [];
    for (const m of metafieldNodes) {
      const fullKey = `${m.namespace}.${m.key}`.toLowerCase();
      if (metaKeySubstrings.some(sub => fullKey.includes(sub))) {
        if (!m.value) continue;
        try {
          const parsed = JSON.parse(m.value);
          if (Array.isArray(parsed)) {
            results.push(...parsed.map(String));
          } else if (typeof parsed === "string") {
            results.push(parsed);
          } else if (typeof parsed === "object" && parsed.children) {
            // Rich text field format
            const textContent = cleanHtmlText(JSON.stringify(parsed));
            if (textContent) results.push(textContent);
          }
        } catch {
          results.push(String(m.value));
        }
      }
    }
    return results.filter(Boolean);
  }

  const metaColors = parseMetaList(["color"]);
  const metaMaterials = parseMetaList(["material", "fabric", "upholstery"]);
  const metaFeatures = parseMetaList(["feature", "function"]);
  const metaOrientations = parseMetaList(["orientation"]);
  const metaStyles = parseMetaList(["style"]);
  const metaSeats = parseMetaList(["seat", "capacity"]);
  const metaSizes = parseMetaList(["size", "width", "dimension"]);

  const availableColors = Array.from(new Set([...optionColors, ...variantColors, ...metaColors].filter(Boolean)));
  const availableMaterials = Array.from(new Set([...optionMaterials, ...variantMaterials, ...metaMaterials].filter(Boolean)));
  const availableSizesCombined = Array.from(new Set([...availableSizes, ...metaSizes].filter(Boolean)));

  // Which variant does the featured image belong to? Its options are the
  // colors the customer actually SEES in the grid — "has a green variant"
  // and "pictures green" are different claims.
  const vEdges: any[] = node.variants?.edges || [];

  // "In stock" = can be purchased right now. availableForSale is Shopify's
  // authoritative flag (respects continue-selling policy + fulfillment
  // locations); totalInventory sums ALL locations — a chair with 100 units in
  // a showroom that doesn't fulfill online is still unbuyable, so only use it
  // when no variant payload was fetched.
  const inStock = vEdges.length > 0
    ? vEdges.some((v: any) => v.node?.availableForSale !== false)
    : (node.totalInventory ?? 0) > 0;
  let picturedColors: string[] = [];
  const featuredUrl = (node.featuredImage?.url || "").split("?")[0];
  if (vEdges.length > 0) {
    const pictured =
      (featuredUrl && vEdges.find((v: any) => (v.node?.image?.url || "").split("?")[0] === featuredUrl)) ||
      vEdges[0];
    picturedColors = (pictured?.node?.selectedOptions || [])
      .filter((so: any) => so.name && /color|fabric|material|finish|upholstery|leather/i.test(so.name))
      .map((so: any) => so.value)
      .filter(Boolean);
  }

  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    vendor: node.vendor || "Jennifer Furniture",
    productType: node.productType || "Furniture",
    minPrice,
    maxPrice,
    currency,
    inStock,
    totalInventory: node.totalInventory ?? 0,
    featuredImage: node.featuredImage?.url || null,
    availableColors,
    availableMaterials,
    availableSizes: availableSizesCombined,
    collections,
    features: metaFeatures,
    orientation: metaOrientations,
    styles: metaStyles,
    seatingCapacity: metaSeats,
    tags: node.tags || [],
    status: node.status || undefined,
    publishedAt: node.publishedAt || null,
    matchedVariantId: node.variants?.edges?.[0]?.node?.id,
    picturedColors,
  };
}

export function normalizeProductDetailed(node: any): ProductDetailed {
  const summary = normalizeProductSummary(node);
  const cleanDescription = cleanHtmlText(node.descriptionHtml || node.description);

  const metafieldNodes = node.metafields?.edges?.map((e: any) => e.node) || [];
  const dimensions = extractDimensions(cleanDescription, metafieldNodes);
  const materials = extractMaterial(summary.tags, cleanDescription, metafieldNodes);

  const ratingMeta = metafieldNodes.find(
    (m: any) => m.namespace === "reviews" && m.key === "rating_count"
  );
  const ratingCount = ratingMeta ? parseInt(ratingMeta.value, 10) : null;

  const variants: ProductVariant[] = (node.variants?.edges || []).map((e: any) => ({
    id: e.node.id,
    title: e.node.title,
    sku: e.node.sku || "",
    price: e.node.price,
    compareAtPrice: e.node.compareAtPrice,
    availableForSale: e.node.availableForSale ?? true,
    inventoryQuantity: e.node.inventoryQuantity ?? 0,
    selectedOptions: e.node.selectedOptions || [],
    image: e.node.image,
  }));

  const images = (node.images?.edges || []).map((e: any) => ({
    url: e.node.url,
    altText: e.node.altText,
  }));

  return {
    ...summary,
    description: cleanDescription,
    specifications: {
      dimensions,
      materials,
      ratingCount,
      careInstructions: "Spot clean with upholstery shampoo or mild solvent-based cleaner.",
      warranty: "1-Year Manufacturer Limited Warranty + Extended Protection Available",
    },
    options: node.options || [],
    variants,
    images,
  };
}

export function buildComparisonMatrix(products: ProductDetailed[]): ProductComparisonMatrix {
  if (!products || products.length === 0) {
    return {
      products: [],
      summaryRecommendation: "No products available for comparison.",
      bestValueId: "",
      mostPremiumId: "",
    };
  }

  let lowestPrice = Infinity;
  let highestPrice = -Infinity;
  let bestValueId = products[0].id;
  let mostPremiumId = products[0].id;

  const comparedProducts = products.map((p) => {
    if (p.minPrice < lowestPrice) {
      lowestPrice = p.minPrice;
      bestValueId = p.id;
    }
    if (p.minPrice > highestPrice) {
      highestPrice = p.minPrice;
      mostPremiumId = p.id;
    }

    const pros: string[] = [];
    const cons: string[] = [];

    if (p.inStock) {
      pros.push(`Ready to ship immediately (Stock: ${p.totalInventory > 0 ? p.totalInventory : "Available"})`);
    } else {
      cons.push("Limited inventory / Made to order");
    }

    if (p.tags.some((t) => t.toLowerCase().includes("sleeper"))) {
      pros.push("Integrated sleeper functionality with pull-out mattress");
    }
    if (p.tags.some((t) => t.toLowerCase().includes("power-reclining") || t.toLowerCase().includes("reclining"))) {
      pros.push("Power adjustable reclining mechanism");
    }
    if (p.availableColors.length > 1) {
      pros.push(`Multiple color options (${p.availableColors.join(", ")})`);
    }

    const keyHighlights = [
      `Price: $${p.minPrice.toFixed(2)}`,
      `Brand: ${p.vendor}`,
      `Material: ${p.specifications.materials}`,
      `Dimensions: ${p.specifications.dimensions}`,
    ];

    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      vendor: p.vendor,
      price: p.minPrice,
      compareAtPrice: p.variants[0]?.compareAtPrice ? parseFloat(p.variants[0].compareAtPrice) : null,
      inStock: p.inStock,
      totalInventory: p.totalInventory,
      featuredImage: p.featuredImage,
      dimensions: p.specifications.dimensions || "Standard Sizing",
      material: p.specifications.materials || "High-Grade Upholstery",
      keyHighlights,
      pros: pros.length > 0 ? pros : ["Contemporary styling", "Durable construction"],
      cons: cons.length > 0 ? cons : ["Requires room clearance for delivery"],
    };
  });

  const bestValProd = products.find((p) => p.id === bestValueId);
  const mostPremProd = products.find((p) => p.id === mostPremiumId);

  const summaryRecommendation = products.length === 1
    ? `The ${products[0].title} is an excellent choice at $${products[0].minPrice.toFixed(2)}.`
    : `For budget-conscious buyers seeking maximum value, the ${bestValProd?.title} ($${bestValProd?.minPrice.toFixed(2)}) offers exceptional features. For higher-end craftsmanship and premium materials, consider the ${mostPremProd?.title} ($${mostPremProd?.minPrice.toFixed(2)}).`;

  return {
    products: comparedProducts,
    summaryRecommendation,
    bestValueId,
    mostPremiumId,
  };
}
