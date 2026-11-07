"use client";

import { useTranslations } from "next-intl";
import { DataTable } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { FormError } from "@/components/shared/form/form-error";
import { EmptyState } from "@/components/shared/states/empty-state";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { ApiFailureState } from "@/features/auth/public";
import { Link } from "@/lib/i18n/navigation";
import type { PatientSummary } from "../types";
import {
  otherRefusals,
  searchFieldErrors,
  usePatientSearch,
} from "../use-patient-search";
import { usePatientColumns, usePatientFilters } from "./patient-columns";

/**
 * Patient search for choosing someone, with the same rules. A row has no link to the record, as choosing
 * mustn't write an opening. Its terms go when it's removed, once someone has been chosen.
 */
export function PatientChooser({
  onChoose,
}: {
  onChoose: (patient: PatientSummary) => void;
}) {
  const t = useTranslations("patients");
  const tAuth = useTranslations("auth");
  const filters = usePatientFilters();
  const base = usePatientColumns((patient) => (
    <UserText>{patient.full_name}</UserText>
  ));
  const columns = [
    ...base,
    {
      id: "choose",
      header: t("chooser.choose"),
      cell: (patient: PatientSummary) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t("chooser.chooseNamed", { name: patient.full_name })}
          onClick={() => onChoose(patient)}
        >
          {t("chooser.choose")}
        </Button>
      ),
    },
  ];
  const { answer, needsTerm, results, search, reset, retry, goToPage } =
    usePatientSearch();

  if (answer.kind === "failed" && answer.error.status === 403) {
    return <ApiFailureState error={answer.error} />;
  }

  const refused = answer.kind === "failed" && answer.error.status === 422;

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        filters={filters}
        applyLabel={t("search.button")}
        errors={searchFieldErrors(answer)}
        onApply={search}
        onReset={reset}
      />

      {needsTerm ? <FormError messages={[t("search.needTerm")]} /> : null}
      {refused ? (
        <FormError
          messages={otherRefusals(answer.error, tAuth("errors.unavailable"))}
        />
      ) : null}

      <div ref={results} tabIndex={-1} className="outline-none">
        {answer.kind === "none" ? (
          <p className="text-muted-foreground">
            {t("search.promptDescription")}
          </p>
        ) : null}
        {answer.kind === "reading" ? (
          <DataTable
            columns={columns}
            rows={[]}
            getRowKey={(patient) => String(patient.id)}
            caption={t("chooser.caption")}
            state="loading"
          />
        ) : null}
        {answer.kind === "failed" && !refused ? (
          <ApiFailureState error={answer.error} onRetry={retry} />
        ) : null}
        {answer.kind === "found" ? (
          <DataTable
            columns={columns}
            rows={answer.page.data}
            getRowKey={(patient) => String(patient.id)}
            caption={t("chooser.caption")}
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
              onPage: goToPage,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
