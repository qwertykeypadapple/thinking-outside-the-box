import type { EmbeddingProvider } from "./types";

type VoyageResponse = {
  data?: Array<{ embedding: number[]; index: number }>;
  error?: { message?: string };
};

const MAX_INPUT_CHARS = 12_000; // ~3k tokens; well within voyage-3's 32k window.

export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly name = "voyage";
  readonly dimensions = 1024;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = "voyage-3",
  ) {}

  async embed(
    text: string,
    opts: { kind?: "document" | "query"; signal?: AbortSignal } = {},
  ): Promise<number[]> {
    const trimmed = text.slice(0, MAX_INPUT_CHARS).trim();
    if (!trimmed) throw new Error("voyage.embed: empty input");

    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: trimmed,
        input_type: opts.kind ?? "document",
      }),
      signal: opts.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`voyage ${res.status}: ${detail.slice(0, 200)}`);
    }

    const json = (await res.json()) as VoyageResponse;
    const vec = json.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== this.dimensions) {
      throw new Error(
        `voyage: unexpected embedding shape (length ${vec?.length ?? "n/a"}, expected ${this.dimensions})`,
      );
    }
    return vec;
  }
}
