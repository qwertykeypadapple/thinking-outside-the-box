// Regex-based PII redactor. Runs synchronously before persistence so chats can
// safely be flipped to public later (PLAN.md §8.2). Order matters — more specific
// patterns run first so generic ones (e.g. CC) don't swallow them.
//
// This is a first line of defense. An LLM-classifier pass for addresses, full
// names, and edge cases will layer on top in the moderation slice.

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;

// API/secret tokens. Catches the common prefix-based shapes; the long tail of
// custom token formats won't match but those are user-provided, not patterned.
const APIKEY_RE =
  /\b(?:sk|pk|rk|sb_secret|sb_publishable|ghp|gho|ghs|ghu|xoxb|xoxp|AKIA|ASIA|hf_|nvapi-)[-_][A-Za-z0-9_-]{16,}\b/g;

// Credit-card-like sequences (12-19 digits with optional spaces/dashes).
// Validated with Luhn to drop false positives like ISBNs, phone numbers, etc.
const CC_RE = /\b(?:\d[ -]?){11,18}\d\b/g;

// Phone numbers — kept conservative. International (+1 415-555-1234), NANP
// (415-555-1234, (415) 555-1234), plain (4155551234). Requires 7-15 digits total.
const PHONE_RE = /(?:\+?\d{1,3}[\s.\-]?)?\(?\d{2,4}\)?[\s.\-]?\d{3,4}[\s.\-]?\d{3,4}(?!\d)/g;

const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;

// IPv6 — covers full, compressed (::), and IPv4-mapped (::ffff:1.2.3.4).
const IPV6_RE =
  /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{0,4}\b|\b::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}\b/g;

function luhnValid(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export type RedactionKind =
  | "email"
  | "phone"
  | "ssn"
  | "credit_card"
  | "ipv4"
  | "ipv6"
  | "api_key";

export type RedactResult = {
  text: string;
  found: Partial<Record<RedactionKind, number>>;
};

function inc(found: Record<string, number>, kind: RedactionKind): void {
  found[kind] = (found[kind] ?? 0) + 1;
}

export function redact(input: string): RedactResult {
  const found: Record<string, number> = {};
  let text = input;

  // API keys first — they may contain shapes that look like other patterns.
  text = text.replace(APIKEY_RE, () => {
    inc(found, "api_key");
    return "[api-key redacted]";
  });

  text = text.replace(EMAIL_RE, () => {
    inc(found, "email");
    return "[email redacted]";
  });

  text = text.replace(SSN_RE, () => {
    inc(found, "ssn");
    return "[ssn redacted]";
  });

  // Credit cards before phones — both can match digit runs, CC is more specific.
  text = text.replace(CC_RE, (match) => {
    if (luhnValid(match)) {
      inc(found, "credit_card");
      return "[card redacted]";
    }
    return match;
  });

  // IPv6 before IPv4 — IPv6 patterns are more restrictive and shouldn't overlap.
  text = text.replace(IPV6_RE, () => {
    inc(found, "ipv6");
    return "[ip redacted]";
  });

  text = text.replace(IPV4_RE, () => {
    inc(found, "ipv4");
    return "[ip redacted]";
  });

  // Phone last — most prone to false positives, so it runs on remaining text only.
  text = text.replace(PHONE_RE, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return match;
    inc(found, "phone");
    return "[phone redacted]";
  });

  return { text, found: found as RedactResult["found"] };
}

export function hasPii(result: RedactResult): boolean {
  return Object.keys(result.found).length > 0;
}
