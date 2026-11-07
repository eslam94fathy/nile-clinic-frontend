"use client";

import { useLocale } from "next-intl";
import { useCallback, useRef, useState } from "react";
import type { ApiError } from "@/lib/api/api-error";
import { readEncounter, readHistory } from "./api/encounters";
import type { Encounter, HistoryPage } from "./types";

type FailedRead =
  { kind: "history"; page: number } | { kind: "record"; id: number };

export type PanelState =
  | { view: "closed" }
  | { view: "reading" }
  | { view: "history"; page: HistoryPage }
  | { view: "record"; record: Encounter; from: HistoryPage | null }
  /** `failedRead` says which read to repeat, and no other, as each writes its own entry. */
  | { view: "failed"; error: ApiError; failedRead: FailedRead };

/**
 * What the panel beside a draft holds. Each read here writes a permanent entry, so every one runs directly from a
 * person's click, in the handler. There's no effect and no address, so nothing can repeat them (research R6). Closing
 * drops everything held. A dead session is passed up, as leaving would lose what's typed beside it (ADR 0014).
 */
export function useHistoryPanel(
  patientId: number,
  onSessionEnded: () => void,
): {
  state: PanelState;
  reading: boolean;
  openHistory: (page?: number) => Promise<void>;
  openRecord: (id: number) => Promise<void>;
  back: () => void;
  close: () => void;
} {
  const locale = useLocale();
  const [state, setState] = useState<PanelState>({ view: "closed" });
  const [reading, setReading] = useState(false);
  const newest = useRef(0);

  const fail = useCallback(
    (error: ApiError, failedRead: FailedRead) => {
      if (error.status === 401) {
        onSessionEnded();
        setState({ view: "closed" });
        return;
      }
      setState({ view: "failed", error, failedRead });
    },
    [onSessionEnded],
  );

  const openHistory = useCallback(
    async (page = 1) => {
      newest.current += 1;
      const request = newest.current;
      setReading(true);
      setState((current) =>
        current.view === "history" ? current : { view: "reading" },
      );

      const result = await readHistory(patientId, page, locale, true);
      if (request !== newest.current) return;

      setReading(false);
      if (result.ok) setState({ view: "history", page: result.data });
      else fail(result.error, { kind: "history", page });
    },
    [fail, locale, patientId],
  );

  const openRecord = useCallback(
    async (id: number) => {
      newest.current += 1;
      const request = newest.current;
      const from = state.view === "history" ? state.page : null;
      setReading(true);
      setState({ view: "reading" });

      const result = await readEncounter(id, locale, true);
      if (request !== newest.current) return;

      setReading(false);
      if (result.ok) setState({ view: "record", record: result.data, from });
      else fail(result.error, { kind: "record", id });
    },
    [fail, locale, state],
  );

  /** Shows the page already held, so this writes nothing. */
  const back = useCallback(() => {
    setState((current) =>
      current.view === "record" && current.from
        ? { view: "history", page: current.from }
        : { view: "closed" },
    );
  }, []);

  const close = useCallback(() => {
    newest.current += 1;
    setReading(false);
    setState({ view: "closed" });
  }, []);

  return { state, reading, openHistory, openRecord, back, close };
}
