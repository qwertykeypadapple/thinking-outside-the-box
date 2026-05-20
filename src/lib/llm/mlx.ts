import type { ChatMessage, ChatProvider, StreamOptions } from "./types";

type DeltaChunk = {
  choices?: Array<{ delta?: { content?: string } }>;
};

export class MLXProvider implements ChatProvider {
  readonly name = "mlx";

  constructor(
    readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async *streamChat(messages: ChatMessage[], opts: StreamOptions = {}): AsyncIterable<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer local-mlx",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1024,
        // Qwen3-family hybrid thinking mode adds 500+ reasoning tokens before the
        // actual reply. Off by default — flip per-request if a hard question warrants it.
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`MLX server ${res.status}: ${text.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const chunk = JSON.parse(payload) as DeltaChunk;
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // Ignore malformed chunks — server occasionally emits keepalive lines.
        }
      }
    }
  }
}
