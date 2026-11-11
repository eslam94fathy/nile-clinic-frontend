"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiError } from "@/lib/api/api-error";
import { useRouter } from "@/lib/i18n/navigation";
import { searchAuditEntries } from "./api/audit";
import type { AuditFilters, AuditPage } from "./types";

export type AuditMove = "search" | "older" | "newer";

export type ShownPage = {
  /** What this page was read with. Older and Newer send these, never the form's current values. */
  filters: AuditFilters;
  page: AuditPage;
  /** No `prev_cursor`: these are the newest entries for the filters. */
  newest: boolean;
};

export type AuditSearchState =
  | { kind: "idle" }
  | { kind: "reading"; move: AuditMove; previous: ShownPage | null }
  | {
      kind: "failed";
      move: AuditMove;
      error: ApiError;
      previous: ShownPage | null;
    }
  | { kind: "shown"; shown: ShownPage };

type Request = {
  filters: AuditFilters;
  cursor: string | null;
  move: AuditMove;
};

export function shownOf(state: AuditSearchState): ShownPage | null {
  if (state.kind === "shown") return state.shown;
  if (state.kind === "idle") return null;
  return state.previous;
}

/** A `422` on the cursor: the position no longer decodes, so only a new search from the newest can continue. */
export const positionRefused = (error: ApiError) =>
  error.status === 422 && Object.hasOwn(error.fieldErrors, "cursor");

/**
 * The audit search. **Each request writes a permanent `audit.searched` entry**, so a request is made only inside a
 * person's press: Search, Older, Newer, Try again, or Start again, once per press (ADR 0018). No effect here reads;
 * everything is held in this component's state, so going back to a held page shows it again without a read, and a
 * reload starts empty.
 */
export function useAuditSearch() {
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState<AuditSearchState>({ kind: "idle" });
  // Set before the request, so a second press before React re-renders can't send another (research R2).
  const busy = useRef(false);
  const newest = useRef(0);
  const last = useRef<Request | null>(null);
  const shown = useRef<ShownPage | null>(null);
  const moved = useRef(false);
  const results = useRef<HTMLDivElement>(null);

  const run = useCallback(
    async (request: Request) => {
      if (busy.current) return;
      busy.current = true;
      newest.current += 1;
      const mine = newest.current;
      last.current = request;
      moved.current = request.move !== "search";
      setState((before) => ({
        kind: "reading",
        move: request.move,
        previous: shownOf(before),
      }));

      const result = await searchAuditEntries(
        request.filters,
        request.cursor,
        locale,
      );
      if (mine !== newest.current) return;
      busy.current = false;

      if (result.ok) {
        const page: ShownPage = {
          filters: request.filters,
          page: result.data,
          newest: result.data.meta.prev_cursor === null,
        };
        shown.current = page;
        setState({ kind: "shown", shown: page });
        return;
      }

      // This person may no longer read the trail, so what's on screen and the filters go, nothing can be tried
      // again, and the gate and navigation re-decide.
      if (result.error.status === 403) {
        last.current = null;
        shown.current = null;
        router.refresh();
      }
      setState({
        kind: "failed",
        move: request.move,
        error: result.error,
        previous: shown.current,
      });
    },
    [locale, router],
  );

  // Only moves focus, after a press replaced the button that had it. It never reads.
  useEffect(() => {
    if (!moved.current || state.kind === "reading") return;
    moved.current = false;
    results.current?.focus();
  }, [state]);

  const move = (direction: "older" | "newer") => {
    const page = shown.current;
    const cursor =
      direction === "older"
        ? page?.page.meta.next_cursor
        : page?.page.meta.prev_cursor;
    if (!page || !cursor) return;
    void run({ filters: page.filters, cursor, move: direction });
  };

  return {
    state,
    busy: state.kind === "reading" ? state.move : null,
    results,
    search: (filters: AuditFilters) =>
      void run({ filters, cursor: null, move: "search" }),
    older: () => move("older"),
    newer: () => move("newer"),
    /** The same request again, as the person asked. */
    retry: () => {
      if (last.current) void run(last.current);
    },
    /** After a refused position: the same filters, from the newest. */
    startAgain: () => {
      const page = shown.current;
      if (page)
        void run({ filters: page.filters, cursor: null, move: "search" });
    },
    /** Forgets everything without reading. A read still on its way is ignored when it arrives. */
    clear: () => {
      newest.current += 1;
      busy.current = false;
      last.current = null;
      shown.current = null;
      setState({ kind: "idle" });
    },
  };
}
