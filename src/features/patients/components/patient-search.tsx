"use client";

import { useTranslations } from "next-intl";
import { DataTable } from "@/components/shared/data-table";
import {
  FilterBar,
  type FilterDefinition,
} from "@/components/shared/filter-bar";
import { FormError } from "@/components/shared/form/form-error";
import { EmptyState } from "@/components/shared/states/empty-state";
import { Button } from "@/components/ui/button";
import { ApiFailureState } from "@/features/auth/public";
import { Link } from "@/lib/i18n/navigation";
import {
  otherRefusals,
  searchFieldErrors,
  usePatientSearch,
} from "../use-patient-search";
import { usePatientColumns, usePatientFilters } from "./patient-columns";

export function PatientSearch() {
  const t = useTranslations("patients");
  const tAuth = useTranslations("auth");
  const columns = usePatientColumns();
  const filters: FilterDefinition[] = usePatientFilters();
  const { answer, needsTerm, results, search, reset, retry, goToPage } =
    usePatientSearch();

  if (answer.kind === "failed" && answer.error.status === 403) {
    return <ApiFailureState error={answer.error} />;
  }

  const refused = answer.kind === "failed" && answer.error.status === 422;

  return (
    <section className="flex flex-col gap-4">
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
          <ApiFailureState error={answer.error} onRetry={retry} />
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
              onPage: goToPage,
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
