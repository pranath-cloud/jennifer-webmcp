/**
 * Embedding client — OpenRouter /embeddings.
 * Default model: google/gemini-embedding-2 — multimodal (text+image+video+audio)
 * in ONE shared 768-dim space, so a text query can match product photos
 * directly. Graceful: returns [] on any failure so search degrades to FTS-only.
 */

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "google/gemini-embedding-2";
const EMBEDDING_DIMS = parseInt(process.env.EMBEDDING_DIMS || "768");

export function embeddingsEnabled(): boolean {
  return Boolean(OPENROUTER_KEY);
}

type ContentInput =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function embedInputs(inputs: ContentInput[][]): Promise<number[][]> {
  if (!OPENROUTER_KEY || inputs.length === 0) return [];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: inputs.map((content) => ({ content })),
        dimensions: EMBEDDING_DIMS,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[embeddings] ${res.status}: ${body.slice(0, 200)}`);
      return [];
    }
    const json: any = await res.json();
    const data = json?.data || [];
    return data.map((d: any) => d.embedding || []);
  } catch (e: any) {
    console.error("[embeddings] failed:", e?.message || e);
    return [];
  }
}

/** Embed a batch of texts. Returns one float[] per input (or [] on failure). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  return embedInputs(texts.map((t) => [{ type: "text", text: t.slice(0, 8000) }]));
}

/** Embed a batch of image URLs — same vector space as embedTexts. */
export async function embedImages(urls: string[]): Promise<number[][]> {
  return embedInputs(urls.map((u) => [{ type: "image_url", image_url: { url: u } }]));
}

/** Embed a single query string. Returns [] on failure. */
export async function embedQuery(text: string): Promise<number[]> {
  const v = await embedTexts([text]);
  return v[0] || [];
}

/** Cosine similarity of two equal-length vectors. */
export function cosine(a: number[] | Float32Array, b: number[] | Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i], y = b[i];
    dot += x * y; na += x * x; nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Text used to embed a product — matches how customers describe items. */
export function productEmbeddingText(s: any): string {
  return [
    s.title || "",
    s.vendor || "",
    s.productType || "",
    (s.tags || []).join(" "),
    (s.collections || []).join(" "),
    (s.availableColors || []).join(" "),
    (s.availableMaterials || []).join(" "),
    (s.features || []).join(" "),
  ].join(" ").replace(/\s+/g, " ").trim().slice(0, 4000);
}
