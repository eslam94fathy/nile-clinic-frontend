"use client";

import { useEffect } from "react";
import { followSessionEndInOtherTabs } from "@/lib/auth/session-end";

/** Lives in the signed-in frame's static part, so that it's there even while a page loads. */
export function SessionWatcher() {
  useEffect(() => {
    const stopFollowing = followSessionEndInOtherTabs();

    // A page restored from the back-forward cache shows what it last showed. Reloading lets the server
    // decide. Pages are also sent as `no-store`, which keeps most browsers from restoring them at all.
    const reloadIfRestored = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", reloadIfRestored);

    return () => {
      stopFollowing();
      window.removeEventListener("pageshow", reloadIfRestored);
    };
  }, []);

  return null;
}
