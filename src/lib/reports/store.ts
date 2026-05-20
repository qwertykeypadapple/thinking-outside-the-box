import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ReportStatus = "open" | "resolved" | "dismissed";

export type ReportRecord = {
  id: string;
  chat_id: string;
  reporter_handle: string | null;
  reason: string;
  status: ReportStatus;
  auto_category: string | null;
  auto_confidence: number | null;
  message_id: string | null;
  created_at: string;
  resolved_at: string | null;
};

// Skip auto-filing if the same chat already has an OPEN auto-report for the
// same category within this window. Stops the classifier from spamming the
// queue when a single offending chat keeps getting appended to.
const AUTO_REPORT_DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1h

export async function createReport(
  chatId: string,
  reporterHandle: string | null,
  reason: string,
): Promise<void> {
  const trimmed = reason.trim().slice(0, 500);
  if (!trimmed) throw new Error("reason required");
  const { error } = await getSupabaseAdmin().from("reports").insert({
    chat_id: chatId,
    reporter_handle: reporterHandle,
    reason: trimmed,
  });
  if (error) throw new Error(`createReport: ${error.message}`);
}

export async function listOpenReports(limit = 100): Promise<ReportRecord[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("reports")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listOpenReports: ${error.message}`);
  return (data ?? []) as ReportRecord[];
}

export async function resolveReport(
  id: string,
  status: Exclude<ReportStatus, "open">,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("reports")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`resolveReport: ${error.message}`);
}

// Auto-filed by the moderation classifier. reporter_handle stays null so the
// admin UI can render an "auto" badge. Dedup short-circuits if the same chat
// already has an open report for the same category within the window — keeps
// the queue actionable when a single bad actor keeps typing.
export async function createAutoReport(args: {
  chatId: string;
  category: string;
  confidence: number;
  reason: string;
  messageId?: string | null;
}): Promise<{ created: boolean }> {
  const sb = getSupabaseAdmin();

  const since = new Date(Date.now() - AUTO_REPORT_DEDUP_WINDOW_MS).toISOString();
  const { data: existing, error: dedupErr } = await sb
    .from("reports")
    .select("id")
    .eq("chat_id", args.chatId)
    .eq("status", "open")
    .eq("auto_category", args.category)
    .gte("created_at", since)
    .limit(1);
  if (dedupErr) throw new Error(`createAutoReport dedup: ${dedupErr.message}`);
  if (existing && existing.length > 0) return { created: false };

  // Compact, scannable reason for the queue.
  const text = `[auto:${args.category} ${(args.confidence * 100).toFixed(0)}%] ${args.reason}`.slice(0, 500);

  const { error } = await sb.from("reports").insert({
    chat_id: args.chatId,
    reporter_handle: null,
    reason: text,
    auto_category: args.category,
    auto_confidence: args.confidence,
    message_id: args.messageId ?? null,
  });
  if (error) throw new Error(`createAutoReport: ${error.message}`);
  return { created: true };
}
