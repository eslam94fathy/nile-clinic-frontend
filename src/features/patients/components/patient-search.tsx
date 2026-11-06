"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import {
  FilterBar,
  type FilterDefinition,
  type FilterValues,
} from "@/components/shared/filter-bar";
import { FormError } from "@/components/shared/form/form-error";
import { EmptyState } from "@/components/shared/states/empty-state";
import { Button } from "@/components/ui/button";
import { ApiFailureState } from "@/features/auth/public";
import type { ApiError } from "@/lib/api/api-error";
import { toWesternDigits } from "@/lib/format/digits";
import { Link } from "@/lib/i18n/navigation";
import { type PatientPage, searchPatients } from "../api/patients";
import { changeCount } from "../opening";
import { normalizeNationalId, normalizePhone } from "../schemas/patient";
import type { PatientSearchTerms } from "../types";
import { usePatientColumns } from "./patient-columns";

type Answer =
  | { kind: "none" }
  | { kind: "reading" }
  | { kind: "failed"; error: ApiError }
  | { kind: "found"; page: PatientPage };

const toTerms = (values: FilterValues): PatientSearchTerms => ({
  name: values.name ?? "",
  phone: normalizePhone(values.phone ?? ""),
  id: toWesternDigits(values.id ?? "").trim(),
  national_id: normalizeNationalId(values.national_id ?? ""),
});

const SEARCH_FIELDS = new Set(["name", "phone", "id", "national_id"]);

function fieldErrorsOf(answer: Answer): Partial<Record<string, string>> {
  if (answer.kind !== "failed" || answer.error.status !== 422) return {};

  return Object.fromEntries(
    Object.entries(answer.error.fieldErrors)
      .filter(([key]) => SEARCH_FIELDS.has(key))
      .map(([key, messages]) => [key, messages.join(" ")]),
  );
}

/** Whatever a `422` said that has no field of its own. None of it may be dropped. */
function otherRefusals(error: ApiError, fallback: string): string[] {
  const keys = Object.keys(error.fieldErrors);
  if (keys.length === 0) return [error.message ?? fallback];

  return keys
    .filter((key) => !SEARCH_FIELDS.has(key))
    .flatMap((key) => error.fieldErrors[key] ?? []);
}

/**
 * Finds patients in the browser, because a term can't reach the server without entering the address, which
 * must never hold one (constitution II, ADR 0012). Everything is held in this component, so going back to a
 * held page restores it and a reload clears it. Lists aren't audited, but nobody is listed until a person
 * searches for someone (FR-001, FR-003).
 */
export function PatientSearch() {
  const locale = useLocale();
  const t = useTranslations("patients");
  const tAuth = useTranslations("auth");
  const columns = usePatientColumns();
  const [answer, setAnswer] = useState<Answer>({ kind: "none" });
  const [needsTerm, setNeedsTerm] = useState(false);
  const newest = useRef(0);
  const last = useRef<{ terms: PatientSearchTerms; page: number } | null>(null);
  const changesSeen = useRef(changeCount());
  const paging = useRef(false);
  const results = useRef<HTMLDivElement>(null);

  const run = useCallback(
    async (terms: PatientSearchTerms, page: number) => {
      newest.current += 1;
      const request = newest.current;
      last.current = { terms, page };
      setNeedsTerm(false);
      setAnswer({ kind: "reading" });

      let result = await searchPatients(terms, page, locale);
      // A change can leave fewer pages than there were, and "no patients match" would then be untrue.
      if (
        request === newest.current &&
        page > 1 &&
        result.ok &&
        result.data.data.length === 0
      ) {
        last.current = { terms, page: 1 };
        result = await searchPatients(terms, 1, locale);
      }
      if (request !== newest.current) return;

      setAnswer(
        result.ok
          ? { kind: "found", page: result.data }
          : { kind: "failed", error: result.error },
      );
    },
    [locale],
  );

  const forget = () => {
    newest.current += 1;
    last.current = null;
    setAnswer({ kind: "none" });
  };

  // This runs again each time a held page is shown, so a patient changed elsewhere shows here too (FR-020).
  useEffect(() => {
    const changes = changeCount();
    if (changes === changesSeen.current) return;
    changesSeen.current = changes;

    if (last.current) void run(last.current.terms, last.current.page);
  }, [run]);

  const filters: FilterDefinition[] = [
    {
      type: "text",
      name: "name",
      label: t("fields.fullName"),
      hint: t("search.nameHint"),
      inAddress: false,
    },
    {
      type: "text",
      name: "phone",
      label: t("fields.phone"),
      hint: t("search.wholeValueHint"),
      inAddress: false,
    },
    {
      type: "text",
      name: "id",
      label: t("fields.number"),
      hint: t("search.wholeValueHint"),
      inAddress: false,
    },
    {
      type: "text",
      name: "national_id",
      label: t("fields.nationalId"),
      hint: t("search.wholeValueHint"),
      inAddress: false,
    },
  ];

  // Paging replaces the button that was pressed, so keyboard focus would otherwise fall to the page's start.
  useEffect(() => {
    if (!paging.current || answer.kind === "reading") return;
    paging.current = false;
    results.current?.focus();
  }, [answer]);

  const search = (values: FilterValues) => {
    const terms = toTerms(values);
    if (Object.values(terms).every((term) => term === "")) {
      forget();
      setNeedsTerm(true);
      return;
    }
    void run(terms, 1);
  };

  const refused = answer.kind === "failed" && answer.error.status === 422;

  return (
    <section className="flex flex-col gap-4">
      <FilterBar
        filters={filters}
        applyLabel={t("search.button")}
        errors={fieldErrorsOf(answer)}
        onApply={search}
        onReset={() => {
          forget();
          setNeedsTerm(false);
        }}
      />

      {needsTerm ? <FormError messages={[t("search.needTerm")]} /> : null}
      {refused ? (
        <FormError
          messages={otherRefusals(answer.error, tAuth("errors.unavailable"))}
        />
      ) : null}

      <div ref={results} tabIndex={-1} className="outline-none">
        {answer.kind === "none" ? (
          <EmptyState
            title={t("search.promptTitle")}
            description={t("search.promptDescription")}
          />
        ) : null}
        {answer.kind === "reading" ? (
          <DataTable
            columns={columns}
            rows={[]}
            getRowKey={(patient) => String(patient.id)}
            caption={t("search.caption")}
            state="loading"
          />
        ) : null}
        {answer.kind === "failed" && !refused ? (
          <ApiFailureState
            error={answer.error}
            onRetry={() => {
              if (last.current) {
                void run(last.current.terms, last.current.page);
              }
            }}
          />
        ) : null}
        {answer.kind === "found" ? (
          <DataTable
            columns={columns}
            rows={answer.page.data}
            getRowKey={(patient) => String(patient.id)}
            caption={t("search.caption")}
            state={answer.page.data.length === 0 ? "empty" : "ready"}
            emptyState={
              <div role="status">
                <EmptyState
                  title={t("search.emptyTitle")}
                  description={t("search.emptyDescription")}
                  action={
                    <Button variant="outline" asChild>
                      <Link href="/patients/new" prefetch={false}>
                        {t("register")}
                      </Link>
                    </Button>
                  }
                />
              </div>
            }
            pagination={{
              page: answer.page.meta.current_page,
              lastPage: answer.page.meta.last_page,
              total: answer.page.meta.total,
              onPage: (page) => {
                if (!last.current) return;
                paging.current = true;
                void run(last.current.terms, page);
              },
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
