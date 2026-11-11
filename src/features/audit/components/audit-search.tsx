"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { CursorPager } from "@/components/shared/cursor-pager";
import { FilterBar, type FilterValues } from "@/components/shared/filter-bar";
import { FormError } from "@/components/shared/form/form-error";
import { EmptyState } from "@/components/shared/states/empty-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Button } from "@/components/ui/button";
import { ApiFailureState } from "@/features/auth/public";
import type { ApiError } from "@/lib/api/api-error";
import {
  type FilterProblem,
  readAuditFilters,
  sameFilters,
} from "../read-audit-filters";
import { AUDIT_FILTER_NAMES, type AuditFilterName } from "../types";
import { positionRefused, shownOf, useAuditSearch } from "../use-audit-search";
import { AuditEntry } from "./audit-entry";
import { type StaffChoice, useAuditFilters } from "./audit-filters";

const FILTER_NAMES = new Set<string>(AUDIT_FILTER_NAMES);

function apiFieldErrors(error: ApiError): Partial<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(error.fieldErrors)
      .filter(([key]) => FILTER_NAMES.has(key))
      .map(([key, messages]) => [key, messages.join(" ")]),
  );
}

/** Whatever a `422` said that has no filter of its own, except the cursor, which the pager answers. None is dropped. */
function otherRefusals(error: ApiError, fallback: string): string[] {
  const keys = Object.keys(error.fieldErrors);
  if (keys.length === 0) return [error.message ?? fallback];
  return keys
    .filter((key) => !FILTER_NAMES.has(key) && key !== "cursor")
    .flatMap((key) => error.fieldErrors[key] ?? []);
}

/**
 * The audit log: filters, the entries, and paging. A search runs only when the person presses Search, Older, Newer,
 * or a retry, as each one writes a permanent entry under their name (ADR 0018).
 */
export function AuditSearch({
  staff,
  timeZone,
}: {
  staff: StaffChoice[] | null;
  timeZone: string;
}) {
  const t = useTranslations("audit");
  const tAuth = useTranslations("auth");
  const tStates = useTranslations("shared.states");
  const filters = useAuditFilters(staff);
  const {
    state,
    busy,
    results,
    search,
    older,
    newer,
    retry,
    startAgain,
    clear,
  } = useAuditSearch();
  const [problems, setProblems] = useState<
    Partial<Record<AuditFilterName, FilterProblem>>
  >({});
  // What the form holds, from its last change or Search. Null until then, and after Clear: the form is then empty
  // or holds what was searched.
  const [formValues, setFormValues] = useState<FilterValues | null>(null);
  const shown = shownOf(state);

  if (state.kind === "failed" && state.error.status === 403) {
    return <ApiFailureState error={state.error} />;
  }

  const failedSearch = state.kind === "failed" && state.move === "search";
  const refusedSearch = failedSearch && state.error.status === 422;
  const failedMove = state.kind === "failed" && state.move !== "search";

  // Worked out on every render from what the form holds and what the page on screen was read with, so it is right
  // whichever arrives last: an edit during a read, a refused search, or a search pressed during Older or Newer.
  const formReading = formValues === null ? null : readAuditFilters(formValues);
  const stale =
    shown !== null &&
    formReading !== null &&
    (!formReading.ok || !sameFilters(formReading.filters, shown.filters));

  const errors: Partial<Record<string, string>> = {
    ...(refusedSearch ? apiFieldErrors(state.error) : {}),
    ...Object.fromEntries(
      Object.entries(problems).map(([name, problem]) => [
        name,
        t(`problems.${problem}`),
      ]),
    ),
  };

  function apply(values: FilterValues) {
    setFormValues(values);
    const reading = readAuditFilters(values);
    if (!reading.ok) {
      setProblems(reading.problems);
      return;
    }
    setProblems({});
    search(reading.filters);
  }

  function reset() {
    setProblems({});
    setFormValues(null);
    clear();
  }

  const showPage =
    shown !== null &&
    !(failedSearch && !refusedSearch) &&
    !(state.kind === "reading" && state.move === "search");

  return (
    <section className="flex flex-col gap-4">
      <p className="rounded-lg border bg-muted/40 p-3 text-[0.8125rem]">
        {t("notice")}
      </p>

      {/* A change only updates the out-of-date notice. Nothing is read. Search waits while a page is read, rather
          than being dropped by the hook's one-read-at-a-time guard. */}
      <FilterBar
        filters={filters}
        applyLabel={t("filters.search")}
        resetLabel={t("filters.clear")}
        errors={errors}
        onApply={apply}
        onReset={reset}
        onChange={setFormValues}
        applyBlocked={busy !== null}
      />

      {refusedSearch ? (
        <FormError
          messages={otherRefusals(state.error, tAuth("errors.unavailable"))}
        />
      ) : null}

      <div
        ref={results}
        tabIndex={-1}
        aria-label={t("states.results")}
        className="flex flex-col gap-3 outline-none"
      >
        {state.kind === "idle" || (refusedSearch && shown === null) ? (
          <EmptyState
            title={t("states.beforeSearchTitle")}
            description={t("states.beforeSearch")}
          />
        ) : null}

        {state.kind === "reading" && state.move === "search" ? (
          <LoadingState />
        ) : null}

        {failedSearch && !refusedSearch ? (
          <ApiFailureState error={state.error} onRetry={retry} />
        ) : null}

        {showPage ? (
          <>
            {stale ? (
              <p role="status" className="text-[0.8125rem] font-medium">
                {t("states.outOfDate")}
              </p>
            ) : null}

            {failedMove && positionRefused(state.error) ? (
              <div role="alert" className="flex flex-wrap items-center gap-3">
                <p>{t("states.positionRefused")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startAgain}
                >
                  {t("states.startAgain")}
                </Button>
              </div>
            ) : null}
            {failedMove && !positionRefused(state.error) ? (
              <div role="alert" className="flex flex-wrap items-center gap-3">
                <p>
                  {t("states.moveFailed")}{" "}
                  {state.error.message ?? tAuth("errors.unavailable")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={retry}
                >
                  {tStates("retry")}
                </Button>
              </div>
            ) : null}

            {shown.page.data.length === 0 ? (
              <div role="status">
                <EmptyState
                  title={t("states.emptyTitle")}
                  description={t("states.empty")}
                />
              </div>
            ) : (
              <ol
                aria-busy={state.kind === "reading" || undefined}
                className={`flex flex-col gap-3 ${state.kind === "reading" ? "opacity-60" : ""}`}
              >
                {shown.page.data.map((entry) => (
                  <li key={entry.id}>
                    <AuditEntry entry={entry} timeZone={timeZone} />
                  </li>
                ))}
              </ol>
            )}

            <CursorPager
              hasNewer={shown.page.meta.prev_cursor !== null}
              hasOlder={shown.page.meta.next_cursor !== null}
              onNewer={newer}
              onOlder={older}
              busy={busy === "older" || busy === "newer" ? busy : null}
              atNewest={shown.newest}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
