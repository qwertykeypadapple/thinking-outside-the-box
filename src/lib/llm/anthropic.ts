import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, ChatProvider, StreamOptions } from "./types";

export class AnthropicProvider implements ChatProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(
    readonly model: string,
    apiKey: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async *streamChat(messages: ChatMessage[], opts: StreamOptions = {}): AsyncIterable<string> {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const conversation = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const stream = this.client.messages.stream(
      {
        model: this.model,
        system: system || undefined,
        messages: conversation,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.7,
      },
      { signal: opts.signal },
    );

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }
}
