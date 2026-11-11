"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/states/empty-state";
import { Can } from "@/features/app-shell/public";
import { Count, NoShowRate, SignedMoney } from "@/features/reports/public";
import { ON_DEMAND_QUERY } from "@/lib/api/live-query";
import { readActivityToday, readMoneyToday } from "../api/dashboard";
import { dashboardLinks } from "../links";
import type { ActivityTotals } from "../types";
import { usePanel } from "../use-panel";
import { DashboardGrid } from "./dashboard-grid";
import { DashboardPanel } from "./dashboard-panel";
import { NeedingAMovePanel } from "./needing-a-move-panel";

/**
 * Today's money and activity, and appointments to move (User Story 3). Nothing here reads by itself: as on Reports,
 * figures changing under someone checking cash would mislead (ADR 0016, ADR 0019). The desk's panels aren't here
 * (clarified 2026-11-11).
 */
export function AdministratorDashboard({
  timeZone,
  today,
}: {
  timeZone: string;
  /** The clinic's date when the server rendered the page, for the links until a read gives its own. */
  today: string;
}) {
  return (
    <DashboardGrid>
      <Can capability="reports">
        <MoneyTodayPanel timeZone={timeZone} today={today} />
        <ActivityTodayPanel timeZone={timeZone} today={today} />
      </Can>
      <Can capability="manageAppointments">
        <NeedingAMovePanel timeZone={timeZone} policy={ON_DEMAND_QUERY} />
      </Can>
    </DashboardGrid>
  );
}

/** A label and a value, in one list of terms. */
function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.8125rem] text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

const isZero = (amount: string) => /^-?0+(\.0+)?$/.test(amount);

function MoneyTodayPanel({
  timeZone,
  today,
}: {
  timeZone: string;
  today: string;
}) {
  const t = useTranslations("dashboard.money");
  const tMoney = useTranslations("reports.money");
  const tMethod = useTranslations("shared.paymentMethod");
  const list = usePanel({
    panel: "money-today",
    read: readMoneyToday,
    timeZone,
    policy: ON_DEMAND_QUERY,
  });

  return (
    <DashboardPanel
      panel="money-today"
      heading={t("heading")}
      link={{
        href: dashboardLinks.moneyCollectedToday(list.data?.today ?? today),
        label: t("link"),
      }}
      list={list}
      timeZone={timeZone}
      readsBySelf={false}
    >
      {({ money: { totals, by_method } }) => (
        <>
          <dl className="grid grid-cols-3 gap-4 text-lg">
            <Term label={tMoney("received")}>
              <SignedMoney value={totals.received} />
            </Term>
            <Term label={tMoney("refunded")}>
              <SignedMoney value={totals.refunded} />
            </Term>
            <Term label={tMoney("net")}>
              <SignedMoney value={totals.net} />
            </Term>
          </dl>
          {by_method.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h3 className="text-[0.8125rem] font-medium">{t("byMethod")}</h3>
              <dl className="flex flex-wrap gap-x-6 gap-y-2">
                {by_method.map(({ method, received }) => (
                  <Term
                    key={method}
                    label={tMethod.has(method) ? tMethod(method) : method}
                  >
                    <SignedMoney value={received} />
                  </Term>
                ))}
              </dl>
            </div>
          ) : null}
          {by_method.length === 0 &&
          isZero(totals.received) &&
          isZero(totals.refunded) ? (
            <EmptyState title={t("empty")} />
          ) : null}
        </>
      )}
    </DashboardPanel>
  );
}

const APPOINTMENT_STATUSES = [
  "scheduled",
  "checked_in",
  "completed",
  "no_show",
  "cancelled",
] as const satisfies readonly (keyof ActivityTotals["appointments"])[];
const VISIT_STATUSES = [
  "waiting",
  "with_doctor",
  "seen",
  "left",
] as const satisfies readonly (keyof ActivityTotals["visits"])[];

function ActivityTodayPanel({
  timeZone,
  today,
}: {
  timeZone: string;
  today: string;
}) {
  const t = useTranslations("dashboard.activity");
  const tActivity = useTranslations("reports.activity");
  const tAppointment = useTranslations("shared.status.appointment");
  const tVisit = useTranslations("shared.status.queue");
  const list = usePanel({
    panel: "activity-today",
    read: readActivityToday,
    timeZone,
    policy: ON_DEMAND_QUERY,
  });

  return (
    <DashboardPanel
      panel="activity-today"
      heading={t("heading")}
      link={{
        href: dashboardLinks.activityToday(list.data?.today ?? today),
        label: t("link"),
      }}
      list={list}
      timeZone={timeZone}
      readsBySelf={false}
    >
      {({ totals }) => {
        const nothing =
          Object.values(totals.appointments).every((n) => n === 0) &&
          Object.values(totals.visits).every((n) => n === 0);
        return (
          <>
            <div className="flex flex-col gap-1">
              <h3 className="text-[0.8125rem] font-medium">
                {tActivity("appointments")}
              </h3>
              <dl className="flex flex-wrap gap-x-6 gap-y-2">
                {APPOINTMENT_STATUSES.map((status) => (
                  <Term key={status} label={tAppointment(status)}>
                    <Count value={totals.appointments[status]} />
                  </Term>
                ))}
              </dl>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-[0.8125rem] font-medium">
                {tActivity("visits")}
              </h3>
              <dl className="flex flex-wrap gap-x-6 gap-y-2">
                {VISIT_STATUSES.map((status) => (
                  <Term key={status} label={tVisit(status)}>
                    <Count value={totals.visits[status]} />
                  </Term>
                ))}
                <Term label={tActivity("booked")}>
                  <Count value={totals.visits.booked} />
                </Term>
                <Term label={tActivity("walkIn")}>
                  <Count value={totals.visits.walk_in} />
                </Term>
              </dl>
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              {totals.new_patients !== undefined ? (
                <Term label={tActivity("newPatients")}>
                  <Count value={totals.new_patients} />
                </Term>
              ) : null}
              <Term label={tActivity("noShowRate")}>
                <NoShowRate value={totals.no_show_rate} />
              </Term>
            </dl>
            {nothing ? <EmptyState title={t("empty")} /> : null}
          </>
        );
      }}
    </DashboardPanel>
  );
}
