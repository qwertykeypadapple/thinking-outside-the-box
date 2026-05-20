"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrCreateIdentity } from "@/lib/identity/cookie";
import {
  createChat,
  deleteChat,
  getChat,
  updateChatVisibility,
  type Visibility,
} from "@/lib/chat/store";
import { updateBio, upsertUser } from "@/lib/users/store";
import {
  followHandle,
  followTag,
  isFollowing,
  unfollowHandle,
  unfollowTag,
} from "@/lib/follows/store";
import { createReport, resolveReport, type ReportStatus } from "@/lib/reports/store";
import { recordEvent } from "@/lib/analytics/store";

export async function startNewChat() {
  const { handle } = await getOrCreateIdentity();
  const chat = await createChat(handle);
  void recordEvent("chat_started", handle, { chatId: chat.id, via: "new_button" });
  redirect(`/c/${chat.id}`);
}

export async function deleteChatAction(chatId: string) {
  const { handle } = await getOrCreateIdentity();
  const chat = await getChat(chatId);
  if (!chat) return;
  if (chat.owner_handle !== handle) return;
  await deleteChat(chatId);
  redirect("/");
}

export async function setChatVisibility(chatId: string, visibility: Visibility) {
  const { handle } = await getOrCreateIdentity();
  const chat = await getChat(chatId);
  if (!chat) throw new Error("chat not found");
  if (chat.owner_handle !== handle) throw new Error("forbidden");
  await updateChatVisibility(chatId, visibility);
  // Only emit when visibility actually changed — re-clicking the current
  // state shouldn't inflate funnel counts.
  if (chat.visibility !== visibility) {
    const type = visibility === "public" ? "chat_made_public" : "chat_made_unlisted";
    void recordEvent(type, handle, { chatId, from: chat.visibility });
  }
  revalidatePath(`/c/${chatId}`);
  revalidatePath("/feed");
}

export async function updateBioAction(handle: string, bio: string) {
  const { handle: current } = await getOrCreateIdentity();
  if (current !== handle) throw new Error("forbidden");
  if (bio.length > 280) throw new Error("bio too long");
  // upsert in case the user row hasn't been created yet (e.g. visitor opens
  // their own profile before sending any chats).
  await upsertUser(handle);
  await updateBio(handle, bio);
  revalidatePath(`/u/${handle}`);
}

export async function toggleFollowAction(targetHandle: string): Promise<{ following: boolean }> {
  const { handle } = await getOrCreateIdentity();
  if (handle === targetHandle) throw new Error("cannot follow self");
  await upsertUser(handle);
  const already = await isFollowing(handle, targetHandle);
  if (already) {
    await unfollowHandle(handle, targetHandle);
    void recordEvent("unfollow", handle, { target: targetHandle });
  } else {
    await followHandle(handle, targetHandle);
    void recordEvent("follow", handle, { target: targetHandle });
  }
  revalidatePath(`/u/${targetHandle}`);
  revalidatePath("/feed");
  return { following: !already };
}

export async function reportChatAction(chatId: string, reason: string): Promise<void> {
  const { handle } = await getOrCreateIdentity();
  await createReport(chatId, handle, reason);
  void recordEvent("report_filed", handle, { chatId });
}

export async function resolveReportAction(
  id: string,
  status: Exclude<ReportStatus, "open">,
): Promise<void> {
  const { handle } = await getOrCreateIdentity();
  const admin = process.env.ADMIN_HANDLE;
  if (!admin || admin !== handle) throw new Error("forbidden");
  await resolveReport(id, status);
  revalidatePath("/reports");
}

export async function toggleTagFollowAction(tag: string): Promise<{ following: boolean }> {
  const { handle } = await getOrCreateIdentity();
  await upsertUser(handle);
  const normalized = tag.toLowerCase().trim();
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const { data, error } = await getSupabaseAdmin()
    .from("topic_follows")
    .select("tag")
    .eq("handle", handle)
    .eq("tag", normalized)
    .maybeSingle();
  if (error) throw new Error(`toggleTagFollow read: ${error.message}`);
  if (data) {
    await unfollowTag(handle, normalized);
    void recordEvent("tag_unfollow", handle, { tag: normalized });
    revalidatePath("/feed");
    return { following: false };
  }
  await followTag(handle, normalized);
  void recordEvent("tag_follow", handle, { tag: normalized });
  revalidatePath("/feed");
  return { following: true };
}
