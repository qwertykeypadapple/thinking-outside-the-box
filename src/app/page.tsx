import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/identity/require-identity";
import { createChat, listChats } from "@/lib/chat/store";

// Wave 1.5: jump straight into the user's most recent chat (or create one).
// The full Trending / Live / Following homepage (PLAN.md §2.2) is a later slice.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  // No cookie → bounces through /mint, then comes back here with the cookie set.
  const identity = await requireIdentity("/");

  // /mint set ?welcome=1 on a fresh mint. Forward it to the chat page so
  // chat-view can render the "your handle lives on this device only" notice.
  // Without this passthrough the flag would be dropped in the redirect below.
  const sp = await searchParams;
  const isNew = sp.welcome === "1";

  const recent = await listChats(identity.handle, 1);
  const target = recent[0] ?? (await createChat(identity.handle));
  redirect(`/c/${target.id}${isNew ? "?welcome=1" : ""}`);
}
