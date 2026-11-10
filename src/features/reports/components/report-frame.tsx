"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LastRead } from "@/components/shared/live/last-read";
import { ErrorState } from "@/components/shared/states/error-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { ApiFailureState } from "@/features/auth/public";
import type { LiveList } from "@/lib/api/use-live-list";
import { Link } from "@/lib/i18n/navigation";
import { periodOf, reportHref } from "../report-href";
import { ReportChoices, type ReportChoicesProps } from "./report-choices";

/**
 * What every report shares: its choices, with the read's refusal on them; the period and doctor it covers; when it
 * was read, with Refresh; and the states around the figures (research R7). It's only rendered for a period with no
 * problem, so the read it's given was allowed to happen (research R2).
 */
export function ReportFrame<Data>({
  list,
  choices,
  timeZone,
  children,
}: {
  list: LiveList<Data>;
  choices: ReportChoicesProps;
  timeZone: string;
  children: (data: Data) => ReactNode;
}) {
  const t = useTranslations("reports");
  const { filters, doctors, report } = choices;
  const failure = list.failure;

  if (failure?.status === 403 || failure?.status === 401) {
    return <ApiFailureState error={failure} />;
  }

  const doctor =
    filters.doctorId === null
      ? null
      : (doctors?.find(({ id }) => id === filters.doctorId) ?? null);

  return (
    <div className="flex flex-col gap-4">
      <ReportChoices {...choices} refusal={failure} />

      <div className="flex flex-col gap-2">
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t("periodLabel")}</dt>
            <dd>
              {t.rich("period", {
                from: () => <ClinicDate value={filters.from} />,
                to: () => <ClinicDate value={filters.to} />,
              })}
            </dd>
          </div>
          {filters.doctorId !== null ? (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{t("doctorLabel")}</dt>
              <dd>
                {doctor ? (
                  <UserText>{doctor.name}</UserText>
                ) : (
                  <bdi>{filters.doctorId}</bdi>
                )}
              </dd>
            </div>
          ) : null}
        </dl>
        <LastRead
          readAt={list.readAt}
          outOfDate={list.outOfDate}
          retriesBySelf={false}
          reading={list.reading}
          onRefresh={() => void list.refresh()}
          timeZone={timeZone}
        />
      </div>

      {list.data !== undefined ? (
        children(list.data)
      ) : failure?.status === 404 ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-lg border border-status-warning-border bg-status-warning p-3 text-status-warning-foreground"
        >
          <p className="font-medium">{t("doctorNotFound")}</p>
          <Button variant="outline" size="sm" asChild>
            <Link
              href={reportHref(report, {
                period: periodOf(filters),
                doctorId: null,
              })}
            >
              {t("showAllDoctors")}
            </Link>
          </Button>
        </div>
      ) : failure?.status === 422 ? null : failure ? (
        <ErrorState
          message={failure.message ?? t("readFailed")}
          onRetry={() => void list.refresh()}
        />
      ) : (
        <LoadingState />
      )}
    </div>
  );
}
