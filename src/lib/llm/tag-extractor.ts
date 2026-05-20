import { getProvider, type ChatMessage } from "@/lib/llm";

const SYSTEM_PROMPT = `You extract topic tags from a conversation.
Output ONLY a JSON array of 2 to 3 lowercase strings. No prose, no explanation, no preamble.
Each tag is a single word or short kebab-case phrase, max 20 characters.

Examples of correct output:
["rust","async","performance"]
["parenting","screen-time"]
["calculus","limits"]
["startup-ideas","pricing"]
`.trim();

const MAX_HISTORY_FOR_TAGGING = 12;
const MAX_TAGS = 5;
const MAX_TAG_LEN = 20;

export async function extractTags(messages: ChatMessage[]): Promise<string[]> {
  if (messages.length === 0) return [];
  const provider = getProvider();

  const slice = messages.slice(-MAX_HISTORY_FOR_TAGGING);
  const transcript = slice
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  let output = "";
  try {
    const iter = provider.streamChat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Conversation:\n\n${transcript}\n\nTags:` },
      ],
      { temperature: 0.2, maxTokens: 60 },
    );
    for await (const delta of iter) output += delta;
  } catch {
    return [];
  }

  return parseTagArray(output);
}

export function parseTagArray(raw: string): string[] {
  // Grab the first JSON array shape; tolerates surrounding prose.
  const match = raw.match(/\[[\s\S]*?\]/);
  if (!match) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of parsed) {
    if (typeof v !== "string") continue;
    const n = normalizeTag(v);
    if (!n) continue;
    if (n.length > MAX_TAG_LEN) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

function normalizeTag(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
