"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { ErrorState } from "@/components/shared/states/error-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Button } from "@/components/ui/button";
import { ApiFailureState } from "@/features/auth/public";
import type { useHistoryPanel } from "../use-history-panel";
import { Addenda } from "./addenda";
import { EncounterView } from "./encounter-view";
import { HistoryList } from "./history-list";

/**
 * A plain labelled region, not a dialog, as the doctor must read and type at once, so nothing traps focus. Reading
 * is all in `useHistoryPanel`. It's above the form on a narrow screen, and beside it on a wide one (research R6).
 */
export function HistoryPanel({
  panel,
  timeZone,
  onClosed,
}: {
  panel: ReturnType<typeof useHistoryPanel>;
  timeZone: string;
  /** Where focus goes back to. */
  onClosed: () => void;
}) {
  const t = useTranslations("encounters.panel");
  const errors = useTranslations("auth.errors");
  const heading = useRef<HTMLHeadingElement>(null);
  const { state } = panel;

  // Focus follows what was asked for, as the button pressed can be gone.
  useEffect(() => {
    heading.current?.focus();
  }, [state.view]);

  return (
    <section
      aria-labelledby="history-panel-heading"
      className="order-first flex flex-col gap-4 rounded-lg border p-4 lg:order-last"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="history-panel-heading"
          ref={heading}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          {state.view === "record" ? t("recordHeading") : t("heading")}
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            panel.close();
            onClosed();
          }}
        >
          {t("close")}
        </Button>
      </div>
      <p className="text-[0.8125rem] text-muted-foreground">{t("hint")}</p>
      {state.view === "reading" ? <LoadingState /> : null}
      {state.view === "failed" ? (
        state.error.status === 403 || state.error.status === 404 ? (
          <ApiFailureState error={state.error} />
        ) : (
          <ErrorState
            message={state.error.message ?? errors("unavailable")}
            onRetry={() => {
              const { failedRead } = state;
              void (failedRead.kind === "record"
                ? panel.openRecord(failedRead.id)
                : panel.openHistory(failedRead.page));
            }}
          />
        )
      ) : null}
      {state.view === "history" ? (
        <HistoryList
          items={state.page.data}
          meta={state.page.meta}
          reading={panel.reading}
          onPage={(page) => void panel.openHistory(page)}
          renderOpen={(item) => (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void panel.openRecord(item.id)}
            >
              <PanelOpenLabel />
            </Button>
          )}
        />
      ) : null}
      {state.view === "record" ? (
        <>
          {state.from ? (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={panel.back}
              >
                {t("back")}
              </Button>
            </div>
          ) : null}
          <EncounterView record={state.record} timeZone={timeZone} />
          <Addenda record={state.record} canAdd={false} timeZone={timeZone} />
        </>
      ) : null}
    </section>
  );
}

function PanelOpenLabel() {
  return useTranslations("encounters.history")("open");
}
