import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/identity/cookie";
import { createChat, listChats } from "@/lib/chat/store";

// Wave 1.5: jump straight into the user's most recent chat (or create one).
// The full Trending / Live / Following homepage (PLAN.md §2.2) is a later slice.
export default async function HomePage() {
  const identity = await getIdentity();
  if (!identity) throw new Error("identity missing — proxy did not run");

  const recent = await listChats(identity.handle, 1);
  const target = recent[0] ?? (await createChat(identity.handle));
  redirect(`/c/${target.id}`);
}
