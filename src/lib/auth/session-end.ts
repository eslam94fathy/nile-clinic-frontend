const CHANNEL_NAME = "nile-clinic-session";

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

  sharedChannel()?.postMessage("ended");

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

  sharedChannel()?.postMessage("ended");
  window.location.replace(`/${activeLocale()}/sign-in`);
}

/** Another tab ended the session, so this one leaves too. Returns the way to stop listening. */
export function followSessionEndInOtherTabs(): () => void {
  const shared = sharedChannel();
  if (!shared) return () => {};

  const leave = () => {
    if (ending) return;
    ending = true;
    window.location.replace(`/${activeLocale()}/sign-in`);
  };

  shared.addEventListener("message", leave);
  return () => shared.removeEventListener("message", leave);
}
