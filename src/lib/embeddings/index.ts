import { VoyageEmbeddingProvider } from "./voyage";
import type { EmbeddingProvider } from "./types";

export type { EmbeddingProvider } from "./types";

let cached: EmbeddingProvider | null | undefined;

// Returns null when no embedding provider is configured. Callers treat that
// as "semantic matching disabled" and fall back to tag-overlap.
export function getEmbeddingProvider(): EmbeddingProvider | null {
  if (cached !== undefined) return cached;

  const key = process.env.VOYAGE_API_KEY;
  if (key) {
    const model = process.env.VOYAGE_MODEL ?? "voyage-3";
    cached = new VoyageEmbeddingProvider(key, model);
    return cached;
  }

  cached = null;
  return null;
}
