import { redirect } from "next/navigation";
import { getIdentity, type Identity } from "./cookie";

// Replacement for the proxy.ts-era assumption that every request already has
// a minted cookie. In page Server Components, calling this either returns the
// existing identity OR redirects through /mint, which IS allowed to write
// cookies (Route Handlers can; Server Components can't).
//
// Pass the path you want the user to land on AFTER minting — typically the
// current page's path. /mint sanitizes it against open-redirect attacks and
// appends ?welcome=1 on a fresh mint so chat-view can show the handle notice.
export async function requireIdentity(returnTo: string): Promise<Identity> {
  const identity = await getIdentity();
  if (identity) return identity;
  redirect(`/mint?to=${encodeURIComponent(returnTo)}`);
}
