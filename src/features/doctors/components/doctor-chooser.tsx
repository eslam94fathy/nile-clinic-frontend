"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { FilterBar, type FilterValues } from "@/components/shared/filter-bar";
import { FormError } from "@/components/shared/form/form-error";
import { EmptyState } from "@/components/shared/states/empty-state";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { ApiFailureState } from "@/features/auth/public";
import type { ApiError } from "@/lib/api/api-error";
import { useRouter } from "@/lib/i18n/navigation";
import {
  type ActiveDoctorPage,
  type ActiveDoctorTerms,
  searchActiveDoctors,
} from "../api/doctors";
import { specialtyName } from "../specialty-name";
import type { DoctorSummary, Specialty } from "../types";

type Answer =
  | { kind: "reading" }
  | { kind: "failed"; error: ApiError }
  | { kind: "found"; page: ActiveDoctorPage };

const SEARCH_FIELDS = new Set(["name", "specialty_id"]);

/**
 * Finds an active doctor through the API, which does the name matching, including Arabic spellings. Reads
 * here because results change with no navigation, and what's being booked is held on this screen. Doctors
 * are neither private nor audited.
 */
export function DoctorChooser({
  specialties,
  onChoose,
}: {
  specialties: Specialty[];
  onChoose: (doctor: DoctorSummary) => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("doctors");
  const tAuth = useTranslations("auth");
  const [answer, setAnswer] = useState<Answer>({ kind: "reading" });
  const newest = useRef(0);
  const started = useRef(false);
  const paging = useRef(false);
  const results = useRef<HTMLDivElement>(null);
  const last = useRef<{ terms: ActiveDoctorTerms; page: number }>({
    terms: {},
    page: 1,
  });

  const run = useCallback(
    async (terms: ActiveDoctorTerms, page: number) => {
      newest.current += 1;
      const request = newest.current;
      last.current = { terms, page };
      setAnswer({ kind: "reading" });

      let result = await searchActiveDoctors(terms, page, locale);
      // A change can leave fewer pages than there were, and "no doctors found" would then be untrue.
      if (
        request === newest.current &&
        page > 1 &&
        result.ok &&
        result.data.data.length === 0
      ) {
        last.current = { terms, page: 1 };
        result = await searchActiveDoctors(terms, 1, locale);
      }
      if (request !== newest.current) return;

      if (!result.ok && result.error.status === 403) router.refresh();
      setAnswer(
        result.ok
          ? { kind: "found", page: result.data }
          : { kind: "failed", error: result.error },
      );
    },
    [locale, router],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run({}, 1);
  }, [run]);

  // Paging replaces the button that was pressed, so keyboard focus would otherwise fall to the page's start.
  useEffect(() => {
    if (!paging.current || answer.kind === "reading") return;
    paging.current = false;
    results.current?.focus();
  }, [answer]);

  if (answer.kind === "failed" && answer.error.status === 403) {
    return <ApiFailureState error={answer.error} />;
  }

  const refused = answer.kind === "failed" && answer.error.status === 422;
  const fieldErrors = refused ? answer.error.fieldErrors : {};
  const errors = Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([key]) => SEARCH_FIELDS.has(key))
      .map(([key, messages]) => [key, messages.join(" ")]),
  );
  const others = Object.entries(fieldErrors)
    .filter(([key]) => !SEARCH_FIELDS.has(key))
    .flatMap(([, messages]) => messages);
  const refusals = !refused
    ? []
    : others.length > 0 || Object.keys(errors).length > 0
      ? others
      : [answer.error.message ?? tAuth("errors.unavailable")];

  const columns = [
    {
      id: "name",
      header: t("name"),
      cell: (doctor: DoctorSummary) => (
        <div className="flex flex-col">
          <UserText>{doctor.name}</UserText>
          <span className="text-[0.8125rem] text-muted-foreground">
            <UserText>{doctor.title}</UserText>
          </span>
        </div>
      ),
    },
    {
      id: "specialties",
      header: t("specialties"),
      cell: (doctor: DoctorSummary) => (
        <ul className="flex flex-col">
          {doctor.specialties.map((specialty) => (
            <li key={specialty.id}>
              <UserText>{specialtyName(specialty, locale)}</UserText>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "choose",
      header: t("chooser.choose"),
      cell: (doctor: DoctorSummary) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t("chooser.chooseNamed", { name: doctor.name })}
          onClick={() => onChoose(doctor)}
        >
          {t("chooser.choose")}
        </Button>
      ),
    },
  ];

  const search = (values: FilterValues) =>
    void run(
      {
        name: values.name ?? "",
        specialty_id: values.specialty_id ?? "",
      },
      1,
    );

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        applyLabel={t("chooser.find")}
        errors={errors}
        onApply={search}
        filters={[
          { type: "text", name: "name", label: t("name"), inAddress: false },
          {
            type: "select",
            name: "specialty_id",
            label: t("specialty"),
            inAddress: false,
            options: [
              { value: "", label: t("anySpecialty") },
              ...specialties.map((specialty) => ({
                value: String(specialty.id),
                label: specialtyName(specialty, locale),
              })),
            ],
          },
        ]}
      />
      <FormError messages={refusals} />
      {answer.kind === "failed" && !refused ? (
        <ApiFailureState
          error={answer.error}
          onRetry={() => void run(last.current.terms, last.current.page)}
        />
      ) : null}
      {answer.kind === "reading" ? (
        <DataTable
          caption={t("chooser.caption")}
          columns={columns}
          rows={[]}
          getRowKey={(doctor) => String(doctor.id)}
          state="loading"
        />
      ) : null}
      {answer.kind === "found" ? (
        <div ref={results} tabIndex={-1} className="outline-none">
          <DataTable
            caption={t("chooser.caption")}
            columns={columns}
            rows={answer.page.data}
            getRowKey={(doctor) => String(doctor.id)}
            state={answer.page.data.length === 0 ? "empty" : "ready"}
            emptyState={
              <EmptyState
                title={t("chooser.emptyTitle")}
                description={t("chooser.emptyDescription")}
              />
            }
            pagination={{
              page: answer.page.meta.current_page,
              lastPage: answer.page.meta.last_page,
              total: answer.page.meta.total,
              onPage: (page) => {
                paging.current = true;
                void run(last.current.terms, page);
              },
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
