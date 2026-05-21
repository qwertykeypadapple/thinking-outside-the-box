import { AnthropicProvider } from "./anthropic";
import type { ChatProvider } from "./types";

// Focused signal classifier — answers one question: "is this message
// meaningful enough that the assistant should reply?"
//
// Runs SYNCHRONOUSLY before the assistant stream (unlike the broader safety
// classifier in ./moderator.ts which runs in the background). Cost: one Haiku
// call (~500ms, ~10 input tokens of overhead). The heuristic in
// lib/content/effort.ts is the free pre-filter — this classifier only runs
// for messages that passed it.
//
// Disabled by SIGNAL_GATE_DISABLED=1 (for tests / cost cuts).

export type SignalVerdict = {
  meaningful: boolean;
  reason: string;
};

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 80;
const TIMEOUT_MS = 4000;

const PROMPT = `You decide whether a chat message deserves an AI reply.

Output ONLY one JSON object on a single line, no prose, no fence:
{"meaningful":<true|false>,"reason":"<<=80 chars>"}

Mark meaningful=false ONLY for:
- keysmash / random letters: asdf, ckjsnjkcns, qwertyuiop
- pure character repetition: aaaaaa, hahahah, lololol
- random unrelated nouns/words strung together with no coherent meaning:
  "the bicycle marshmallow Tuesday hat"

Mark meaningful=true for everything else. In particular:
- Short or imperfect English is fine. "u there" is meaningful.
- One-word follow-ups in an ongoing chat are meaningful: yes, no, more?, why.
- Real questions about niche topics are meaningful even if you don't know
  the topic: "what is pgvector", "tell me about hnsw".
- Emotional venting / fragments are meaningful: "ugh", "i can't anymore".

When unsure, return meaningful=true. Better to occasionally answer noise than
to reject real messages.`;

let cachedProvider: ChatProvider | null = null;

function getProvider(): ChatProvider | null {
  if (cachedProvider) return cachedProvider;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = process.env.ANTHROPIC_SIGNAL_MODEL ?? MODEL;
  cachedProvider = new AnthropicProvider(model, apiKey);
  return cachedProvider;
}

export async function classifySignal(
  text: string,
  opts: { isFirstMessage: boolean },
): Promise<SignalVerdict | null> {
  if (process.env.SIGNAL_GATE_DISABLED === "1") return null;
  const trimmed = text.trim();
  if (!trimmed) return { meaningful: false, reason: "empty" };

  const provider = getProvider();
  if (!provider) return null; // no key → soft-bypass (e.g. dev/CI)

  // Cap input to keep latency predictable on extreme outliers. Gibberish
  // signal is determinable from the first few hundred chars.
  const clipped = trimmed.slice(0, 600);
  const position = opts.isFirstMessage ? "the first message of a new chat" : "a follow-up in an ongoing chat";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let output = "";
  try {
    const iter = provider.streamChat(
      [
        { role: "system", content: PROMPT },
        {
          role: "user",
          content: `This is ${position}. Classify:\n\n"""\n${clipped}\n"""`,
        },
      ],
      { temperature: 0.0, maxTokens: MAX_TOKENS, signal: controller.signal },
    );
    for await (const delta of iter) output += delta;
  } catch {
    // Classifier failures must never block chat — soft-bypass.
    return null;
  } finally {
    clearTimeout(timer);
  }

  return parseVerdict(output);
}

export function parseVerdict(raw: string): SignalVerdict | null {
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const obj = parsed as Record<string, unknown>;
  const meaningful =
    typeof obj.meaningful === "boolean"
      ? obj.meaningful
      : String(obj.meaningful).toLowerCase() === "true";
  const reason = typeof obj.reason === "string" ? obj.reason.slice(0, 200) : "";
  return { meaningful, reason };
}
