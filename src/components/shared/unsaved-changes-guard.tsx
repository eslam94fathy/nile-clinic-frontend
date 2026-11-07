"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  askBeforeLeaving,
  hasUnsaved,
  holdUnsaved,
} from "@/lib/unsaved-changes";

/** The Navigation API, which TypeScript's DOM types don't have yet: only the part used here. */
type TraverseEvent = Event & {
  navigationType: string;
  cancelable: boolean;
  destination: { key: string | null };
};
type NavigationLike = EventTarget & {
  traverseTo: (key: string) => unknown;
};

function browserNavigation(): NavigationLike | undefined {
  // Absent in browsers without the API, where back and forward can't be stopped, and a left page stays held.
  return (window as unknown as { navigation?: NavigationLike }).navigation;
}

/**
 * Warns before unsaved text is lost, in one place, so no link needs to know about any form (ADR 0014). Links are
 * caught on their way down, and clicked again if the person leaves, so that each link's own behaviour still runs.
 * Back and forward are cancelled through the Navigation API, as `popstate` was measured to come too late (research
 * R2). A browser may refuse to let one be cancelled, where the left page stays held, with its text.
 */
export function UnsavedChangesGuard({
  unsaved,
  onDiscard,
  onSessionEnded,
}: {
  unsaved: boolean;
  onDiscard: () => void;
  /** Another tab found the session had ended by itself. */
  onSessionEnded: () => void;
}) {
  const t = useTranslations("shared.unsaved");
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const handlers = useRef({ onDiscard, onSessionEnded });

  useEffect(() => {
    handlers.current = { onDiscard, onSessionEnded };
  });

  useEffect(() => {
    if (!unsaved) return;

    const release = holdUnsaved({
      discard: () => handlers.current.onDiscard(),
      ask: (next) => setLeave(() => next),
      sessionEnded: () => handlers.current.onSessionEnded(),
    });

    const onClick = (event: MouseEvent) => {
      if (!hasUnsaved()) return;
      if (
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !link ||
        link.target === "_blank" ||
        link.hasAttribute("download") ||
        link.getAttribute("href")?.startsWith("#")
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      askBeforeLeaving(() => link.click());
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsaved()) return;
      event.preventDefault();
      // Older browsers ask only if this is set.
      event.returnValue = "";
    };

    const navigation = browserNavigation();
    const onNavigate = (event: Event) => {
      const { navigationType, cancelable, destination } =
        event as TraverseEvent;
      if (navigationType !== "traverse" || !cancelable || !hasUnsaved()) return;

      event.preventDefault();
      askBeforeLeaving(() => {
        if (destination.key) navigation?.traverseTo(destination.key);
      });
    };

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("beforeunload", onBeforeUnload);
    navigation?.addEventListener("navigate", onNavigate);
    return () => {
      release();
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("beforeunload", onBeforeUnload);
      navigation?.removeEventListener("navigate", onNavigate);
    };
  }, [unsaved]);

  return (
    <ConfirmDialog
      title={t("title")}
      description={t("description")}
      cancelLabel={t("stay")}
      confirmLabel={t("leave")}
      destructive
      pending={false}
      open={leave !== null}
      onOpenChange={(next) => {
        if (!next) setLeave(null);
      }}
      onConfirm={() => {
        const going = leave;
        setLeave(null);
        going?.();
      }}
    />
  );
}
