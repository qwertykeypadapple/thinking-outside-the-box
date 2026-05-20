export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  // DB row id when loaded from getMessages; absent on transient/optimistic
  // entries the browser inserts before round-tripping the server.
  id?: string;
  // Multi-author public chats: who typed this 'user' turn. Null for assistant
  // turns and for legacy rows that predate this column (migration 0010).
  senderHandle?: string | null;
  // Streaming lifecycle (migration 0012): 'pending' means the assistant row
  // is being filled by the LLM right now — render it with a "still typing"
  // indicator and listen for broadcast deltas. Legacy rows default to
  // 'complete' via DB default.
  status?: "pending" | "complete";
};

export type StreamOptions = {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
};

export interface ChatProvider {
  readonly name: string;
  readonly model: string;
  streamChat(messages: ChatMessage[], opts?: StreamOptions): AsyncIterable<string>;
}
