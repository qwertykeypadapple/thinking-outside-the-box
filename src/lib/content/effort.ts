// Cheap heuristic gate for low-effort posts. Catches the common shapes of
// throwaway content (`asdf`, `aaaaaa`, FULL-CAPS SHOUTING) before any LLM call.
// Runs both on the server (authoritative; route returns 400 with the reason)
// and on the client (disable the Send button + show an inline hint).
//
// Three rules:
//   1. First message of a chat ONLY: must look like an intentful opener.
//      Defined permissively — passes if any of:
//        - 2+ distinct words ("help me", "explain pgvector")
//        - 15+ non-whitespace characters ("antidisestablishmentarianism")
//        - ends with `?` ("why?", "pgvector?")
//      Follow-up messages skip this rule entirely so one-word replies like
//      "yes" or "more?" stay legal.
//   2. Always: no single character occupies > 70% of the non-whitespace content.
//   3. Always: no run of 20+ consecutive uppercase letters (spaces allowed).
//
// `reason` is user-facing and intentionally short.

export type EffortCheck = { ok: true } | { ok: false; reason: string };

const MIN_DISTINCT_WORDS_OPENER = 2;
const MIN_OPENER_LENGTH = 15;
const REPETITION_THRESHOLD = 0.7;
const MAX_ALL_CAPS_LETTERS = 20;

export function checkEffort(
  text: string,
  opts: { isFirstMessage: boolean },
): EffortCheck {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "Write something first." };

  if (opts.isFirstMessage && !looksLikeIntentfulOpener(trimmed)) {
    return {
      ok: false,
      reason: "Try a question or a bit more context to start the chat.",
    };
  }

  if (charRepetitionRatio(trimmed) > REPETITION_THRESHOLD) {
    return {
      ok: false,
      reason: "That looks like a stuck key — try again with normal text.",
    };
  }

  if (hasLongAllCapsRun(trimmed, MAX_ALL_CAPS_LETTERS)) {
    return {
      ok: false,
      reason: "Ease off the caps — keep all-caps runs under 20 letters.",
    };
  }

  return { ok: true };
}

function looksLikeIntentfulOpener(text: string): boolean {
  if (distinctWordCount(text) >= MIN_DISTINCT_WORDS_OPENER) return true;
  if (text.replace(/\s+/g, "").length >= MIN_OPENER_LENGTH) return true;
  if (/\?\s*$/.test(text)) return true;
  return false;
}

function distinctWordCount(text: string): number {
  // Strip punctuation but keep letters (any script), digits, apostrophes,
  // and hyphens. Lowercase so "Hello hello" counts as one distinct word.
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return new Set(words).size;
}

function charRepetitionRatio(text: string): number {
  // Lowercase + drop whitespace so "AAaaa  aaa" reads as repetition.
  const cleaned = text.replace(/\s+/g, "").toLowerCase();
  if (cleaned.length < 6) return 0; // too short to measure meaningfully
  const counts = new Map<string, number>();
  for (const ch of cleaned) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let max = 0;
  for (const n of counts.values()) if (n > max) max = n;
  return max / cleaned.length;
}

function hasLongAllCapsRun(text: string, minLetters: number): boolean {
  // Match contiguous runs of A-Z + whitespace, then verify the count of
  // actual letters (ignoring whitespace). "ALL CAPS LIKE THIS" trips on
  // letter count; a long run that's mostly spaces does not.
  const re = /[A-Z\s]{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].replace(/\s/g, "").length >= minLetters) return true;
  }
  return false;
}
