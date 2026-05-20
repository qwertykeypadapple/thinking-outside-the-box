export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string, opts?: { kind?: "document" | "query"; signal?: AbortSignal }): Promise<number[]>;
}
