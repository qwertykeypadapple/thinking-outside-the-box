import { NextRequest } from "next/server";
import { getOrCreateIdentity } from "@/lib/identity/cookie";
import {
  getChat,
  updateChatVisibility,
  type Visibility,
} from "@/lib/chat/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: Visibility[] = ["unlisted", "public"];

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ chatId: string }> },
) {
  const { chatId } = await ctx.params;
  const { handle } = await getOrCreateIdentity();

  let body: { visibility?: unknown };
  try {
    body = (await req.json()) as { visibility?: unknown };
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const next = body.visibility;
  if (typeof next !== "string" || !ALLOWED.includes(next as Visibility)) {
    return new Response(`visibility must be one of: ${ALLOWED.join(", ")}`, { status: 400 });
  }

  const chat = await getChat(chatId);
  if (!chat) return new Response("not found", { status: 404 });
  if (chat.owner_handle !== handle) return new Response("forbidden", { status: 403 });

  await updateChatVisibility(chatId, next as Visibility);
  return Response.json({ ok: true, visibility: next });
}
