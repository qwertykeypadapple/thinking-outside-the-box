// Tiny display-formatting helpers that were duplicated across feed/search/
// profile/chat-view. Pulling them out so a copy-edit in one place doesn't
// have to be chased through five files. Pure functions, no Next dependencies.

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}

// Coarse "X minutes/hours/days ago" formatter. Renders on the server so
// timestamps don't shift between SSR and hydration. Caller decides where to
// place it — we don't return absolute strings since clients can't tell the
// difference between "just now" and "actually 30 seconds ago" anyway.
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
