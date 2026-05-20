import { MLXProvider } from "./mlx";
import { AnthropicProvider } from "./anthropic";
import type { ChatProvider } from "./types";

export type { ChatMessage, ChatProvider, StreamOptions } from "./types";

let cached: ChatProvider | null = null;

export function getProvider(): ChatProvider {
  if (cached) return cached;

  const choice = (process.env.LLM_PROVIDER ?? "mlx").toLowerCase();

  if (choice === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY required when LLM_PROVIDER=anthropic");
    const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
    cached = new AnthropicProvider(model, apiKey);
    return cached;
  }

  const baseUrl = process.env.MLX_BASE_URL ?? "http://localhost:8080/v1";
  const model = process.env.MLX_MODEL ?? "mlx-community/Qwen3.5-9B-OptiQ-4bit";
  cached = new MLXProvider(model, baseUrl);
  return cached;
}
