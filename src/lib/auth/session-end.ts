import { standAside, tellSessionEnded } from "@/lib/unsaved-changes";

const CHANNEL_NAME = "nile-clinic-session";
/** The session ended by itself, which nobody chose. */
const ENDED = "ended";
/** A person signed out, and meant it. */
const SIGNED_OUT = "signed-out";

let ending = false;
let channel: BroadcastChannel | undefined;

function sharedChannel(): BroadcastChannel | undefined {
  if (typeof BroadcastChannel === "undefined") return undefined;
  // One instance: a channel doesn't receive its own messages, so a tab won't react to itself.
  channel ??= new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

function activeLocale(): string {
  return window.location.pathname.split("/")[1] ?? "";
}

/**
 * The single way a session ends in the browser. Simultaneous failures lead to one redirect. A full
 * navigation clears memory and the hidden screens that Next.js keeps mounted (ADR 0006, rule 5). A client
 * cache added later must be cleared here too.
 */
export function endSession(): void {
  if (ending) return;
  ending = true;
  standAside();

  sharedChannel()?.postMessage(ENDED);

  const query = new URLSearchParams({
    locale: activeLocale(),
    return: window.location.pathname,
  });
  window.location.replace(`/api/auth/session-ended?${query}`);
}

/** After the sign-out route has cleared the cookie. */
export function leaveAfterSignOut(): void {
  if (ending) return;
  ending = true;
  standAside();

  sharedChannel()?.postMessage(SIGNED_OUT);
  window.location.replace(`/${activeLocale()}/sign-in`);
}

/**
 * Another tab ended the session, so this one leaves too. Returns the way to stop listening. Text that's only on
 * screen stays if the session ended by itself, and goes if someone signed out, as they meant it (ADR 0014).
 */
export function followSessionEndInOtherTabs(): () => void {
  const shared = sharedChannel();
  if (!shared) return () => {};

  const follow = (event: MessageEvent) => {
    if (ending) return;
    if (event.data === ENDED && tellSessionEnded()) return;

    ending = true;
    standAside();
    window.location.replace(`/${activeLocale()}/sign-in`);
  };

  shared.addEventListener("message", follow);
  return () => shared.removeEventListener("message", follow);
}
