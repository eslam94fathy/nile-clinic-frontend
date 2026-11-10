"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FilterBar } from "@/components/shared/filter-bar";
import { LastRead } from "@/components/shared/live/last-read";
import { EmptyState } from "@/components/shared/states/empty-state";
import { ErrorState } from "@/components/shared/states/error-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Button } from "@/components/ui/button";
import { ApiFailureState } from "@/features/auth/public";
import { LIVE_QUERY, ON_DEMAND_QUERY } from "@/lib/api/live-query";
import { type PageMeta, pageHref } from "@/lib/api/pagination";
import { allMessages, isOutcomeUnknown } from "@/lib/api/refusal";
import { useLiveList } from "@/lib/api/use-live-list";
import { formatMoney } from "@/lib/format/money";
import { groupByDoctor } from "@/lib/group-by-doctor";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { useKeepFocus } from "@/lib/use-keep-focus";
import { chargeVisit, readVisits } from "../api/billing";
import { BILLING_ROOT_KEY } from "../query-keys";
import {
  type BillingFilters,
  VISIT_CHARGE_STATUSES,
  type VisitCharge,
} from "../types";
import { BillingGroup } from "./billing-group";

type DoctorOption = { id: number; name: string; is_active: boolean };
type VisitList = { visits: VisitCharge[]; meta: PageMeta };

/**
 * About a charge that was refused or may not have happened. Above the rows, as a refresh can remove its row. It
 * belongs to the list it was shown on, so other filters don't show it.
 */
type ChargeNotice = { listKey: string; name: string } & (
  { messages: string[] } | { unknown: true }
);

/**
 * A date's visits and what each owes. Today's list reads itself every 15 seconds while it's on screen; any other
 * date reads only when asked (ADR 0015). Charging sends no amount, as the API takes the doctor's fee.
 */
export function BillingList({
  filters,
  doctors,
  timeZone,
}: {
  filters: BillingFilters;
  /** `null` when they couldn't be read: the list still shows, with less to filter by. */
  doctors: DoctorOption[] | null;
  timeZone: string;
}) {
  const locale = useLocale();
  const t = useTranslations("billing");
  const tStatus = useTranslations("shared.status.charge");
  const shared = useTranslations("shared.form");
  const router = useRouter();
  const { date, isToday, doctorId, chargeStatus, page } = filters;

  const list = useLiveList<VisitList>({
    rootKey: BILLING_ROOT_KEY,
    queryKey: [...BILLING_ROOT_KEY, { date, doctorId, chargeStatus, page }],
    policy: isToday ? LIVE_QUERY : ON_DEMAND_QUERY,
    read: async () => {
      const result = await readVisits(
        { date, doctorId, chargeStatus, page },
        locale,
      );
      return result.ok
        ? {
            ...result,
            data: { visits: result.data.data, meta: result.data.meta },
          }
        : result;
    },
  });

  const heading = useRef<HTMLHeadingElement>(null);
  const keepFocus = useKeepFocus(() => heading.current);
  const inFlight = useRef(false);
  const [charging, setCharging] = useState<number | null>(null);
  const [shownNotice, setNotice] = useState<ChargeNotice | null>(null);
  const listKey = JSON.stringify({ date, doctorId, chargeStatus, page });
  const notice = shownNotice?.listKey === listKey ? shownNotice : null;

  const visits = list.data?.visits ?? [];
  const meta = list.data?.meta ?? null;
  const beyondTheEnd =
    meta !== null && visits.length === 0 && meta.current_page > meta.last_page;
  const filterValues = {
    date: isToday ? undefined : date,
    doctor_id: doctorId === null ? undefined : String(doctorId),
    charge_status: chargeStatus ?? undefined,
  };
  const pageLink = pageHref("/billing", filterValues);

  // The list can shrink under someone on a later page. "No visits" would be untrue.
  useEffect(() => {
    if (beyondTheEnd) router.replace(pageLink(meta.last_page));
    // `pageLink` is new each render, and is decided by the filters, which the address already follows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beyondTheEnd, meta?.last_page, router, date, doctorId, chargeStatus]);

  async function charge(visit: VisitCharge) {
    if (inFlight.current) return;
    inFlight.current = true;
    setCharging(visit.id);
    setNotice(null);

    const result = await chargeVisit(visit.id, locale);
    inFlight.current = false;
    setCharging(null);

    if (result.ok) {
      toast.success(
        t("charge.done", {
          amount: formatMoney(result.data.fee, locale) ?? "",
        }),
      );
      router.push(`/charges/${result.data.id}?charged=1`);
      return;
    }
    const name = visit.patient.full_name;
    setNotice(
      isOutcomeUnknown(result.error)
        ? { listKey, name, unknown: true }
        : {
            listKey,
            name,
            messages: allMessages(result.error, shared("generalFailure")),
          },
    );
    // Whatever was refused, the list on screen was out of date (FR-014). Never sent again by itself (FR-013).
    void list.refresh();
  }

  if (list.failure?.status === 403) {
    return <ApiFailureState error={list.failure} />;
  }

  const narrowed = doctorId !== null || chargeStatus !== null;
  const groups = groupByDoctor(visits);

  return (
    <>
      <FilterBar
        filters={[
          {
            name: "date",
            label: t("fields.date"),
            type: "date",
            inAddress: true,
            defaultValue: date,
          },
          {
            name: "doctor_id",
            label: t("fields.doctor"),
            type: "select",
            inAddress: true,
            ...(doctors ? {} : { hint: t("filters.doctorsUnavailable") }),
            options: [
              { value: "", label: t("filters.anyDoctor") },
              ...(doctors
                ? doctors.map((doctor) => ({
                    value: String(doctor.id),
                    label: doctor.is_active
                      ? doctor.name
                      : t("filters.inactiveDoctor", { name: doctor.name }),
                  }))
                : // Without this, a list narrowed to one doctor would look like everyone's.
                  doctorId !== null
                  ? [{ value: String(doctorId), label: String(doctorId) }]
                  : []),
            ],
          },
          {
            name: "charge_status",
            label: t("fields.chargeStatus"),
            type: "select",
            inAddress: true,
            options: [
              { value: "", label: t("filters.anyChargeStatus") },
              ...VISIT_CHARGE_STATUSES.map((value) => ({
                value,
                label: tStatus(value),
              })),
            ],
          },
        ]}
      />
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold outline-none"
      >
        {t("listHeading")}
      </h2>

      {notice ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-destructive p-3"
        >
          <p className="font-medium text-destructive">
            {"unknown" in notice
              ? t("charge.unknownOutcome", { name: notice.name })
              : t("charge.refused", { name: notice.name })}
          </p>
          {"messages" in notice ? (
            <ul className="flex flex-col gap-1">
              {notice.messages.map((message, index) => (
                // The backend can repeat a message, and none may be dropped.
                <li key={`${index}-${message}`}>{message}</li>
              ))}
            </ul>
          ) : null}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setNotice(null);
                heading.current?.focus();
              }}
            >
              {t("charge.dismiss")}
            </Button>
          </div>
        </div>
      ) : null}

      {list.failure?.status === 404 ? (
        <ApiFailureState error={list.failure} />
      ) : list.failure ? (
        <ErrorState
          message={list.failure.message ?? t("readFailed")}
          onRetry={() => void list.refresh()}
        />
      ) : list.data === undefined || beyondTheEnd ? (
        <LoadingState />
      ) : (
        <>
          <LastRead
            readAt={list.readAt}
            outOfDate={list.outOfDate}
            retriesBySelf={isToday}
            reading={list.reading}
            onRefresh={() => void list.refresh()}
            timeZone={timeZone}
          />
          {groups.length === 0 ? (
            <EmptyState
              title={t(narrowed ? "empty.filteredTitle" : "empty.dateTitle")}
              description={t(
                narrowed
                  ? "empty.filteredDescription"
                  : "empty.dateDescription",
              )}
              action={
                isToday && !narrowed ? (
                  <Button variant="outline" asChild>
                    <Link href="/queue" prefetch={false}>
                      {t("seeQueue")}
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="flex flex-col gap-6" {...keepFocus}>
              {groups.map((group, index) => (
                <BillingGroup
                  key={`${group.doctor.id}-${index}`}
                  group={group}
                  charging={charging}
                  onCharge={(visit) => void charge(visit)}
                  pagination={
                    meta && index === groups.length - 1
                      ? {
                          page: meta.current_page,
                          lastPage: meta.last_page,
                          total: meta.total,
                          hrefForPage: pageLink,
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
