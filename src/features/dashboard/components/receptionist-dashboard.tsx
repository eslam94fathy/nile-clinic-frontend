"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/states/empty-state";
import { Can } from "@/features/app-shell/public";
import { LIVE_QUERY } from "@/lib/api/live-query";
import {
  readMoneyOwed,
  readQueueByStatus,
  readTodaysAppointments,
} from "../api/dashboard";
import { dashboardLinks } from "../links";
import { usePanel } from "../use-panel";
import { AppointmentRows } from "./appointment-rows";
import { DashboardPanel } from "./dashboard-panel";
import { DashboardGrid } from "./dashboard-grid";
import { FigureList } from "./figure-list";
import { NeedingAMovePanel } from "./needing-a-move-panel";

/** The desk's day at a glance (User Story 1). Every panel reads every 15 seconds while it's on screen. */
export function ReceptionistDashboard({ timeZone }: { timeZone: string }) {
  return (
    <DashboardGrid>
      <Can capability="manageAppointments">
        <TodaysAppointmentsPanel timeZone={timeZone} />
      </Can>
      <Can capability="manageQueue">
        <QueuePanel timeZone={timeZone} />
      </Can>
      <Can capability="billing">
        <MoneyOwedPanel timeZone={timeZone} />
      </Can>
      <Can capability="manageAppointments">
        <NeedingAMovePanel timeZone={timeZone} policy={LIVE_QUERY} />
      </Can>
    </DashboardGrid>
  );
}

function TodaysAppointmentsPanel({ timeZone }: { timeZone: string }) {
  const t = useTranslations("dashboard.appointments");
  const list = usePanel({
    panel: "todays-appointments",
    read: readTodaysAppointments,
    timeZone,
    policy: LIVE_QUERY,
  });

  return (
    <DashboardPanel
      panel="todays-appointments"
      heading={t("heading")}
      link={{ href: dashboardLinks.appointmentsToArrive, label: t("link") }}
      list={list}
      timeZone={timeZone}
      readsBySelf
    >
      {(data) => (
        <>
          <FigureList
            figures={[
              {
                id: "to-arrive",
                label: t("toArrive"),
                value: data.toArrive.total,
              },
              { id: "arrived", label: t("arrived"), value: data.arrived },
              { id: "completed", label: t("completed"), value: data.completed },
              { id: "no-show", label: t("noShow"), value: data.noShow },
            ]}
          />
          {data.toArrive.total === 0 ? (
            <EmptyState title={t("empty")} />
          ) : (
            <AppointmentRows
              label={t("listLabel")}
              list={data.toArrive}
              href={dashboardLinks.appointment}
            />
          )}
        </>
      )}
    </DashboardPanel>
  );
}

const QUEUE_STATUSES = ["waiting", "with_doctor", "seen", "left"] as const;

function QueuePanel({ timeZone }: { timeZone: string }) {
  const t = useTranslations("dashboard.queue");
  const tStatus = useTranslations("shared.status.queue");
  const list = usePanel({
    panel: "queue",
    read: (_today, locale) => readQueueByStatus(locale),
    timeZone,
    policy: LIVE_QUERY,
  });

  return (
    <DashboardPanel
      panel="queue"
      heading={t("heading")}
      link={{ href: dashboardLinks.queue, label: t("link") }}
      list={list}
      timeZone={timeZone}
      readsBySelf
    >
      {(data) => {
        const counts = {
          waiting: data.waiting,
          with_doctor: data.withDoctor,
          seen: data.seen,
          ["left"]: data.left,
        };
        return (
          <>
            <FigureList
              figures={QUEUE_STATUSES.map((status) => ({
                id: status,
                label: tStatus(status),
                value: counts[status],
                href: dashboardLinks.queueByStatus(status),
              }))}
            />
            {Object.values(counts).every((count) => count === 0) ? (
              <EmptyState title={t("empty")} />
            ) : null}
          </>
        );
      }}
    </DashboardPanel>
  );
}

const OWED_STATUSES = ["none", "unpaid", "partially_paid"] as const;

function MoneyOwedPanel({ timeZone }: { timeZone: string }) {
  const t = useTranslations("dashboard.owed");
  const tStatus = useTranslations("shared.status.charge");
  const list = usePanel({
    panel: "money-owed",
    read: readMoneyOwed,
    timeZone,
    policy: LIVE_QUERY,
  });

  return (
    <DashboardPanel
      panel="money-owed"
      heading={t("heading")}
      link={{ href: dashboardLinks.billing, label: t("link") }}
      list={list}
      timeZone={timeZone}
      readsBySelf
    >
      {(data) => {
        // The same words as Billing's filter, so a figure and the list it opens are named alike.
        const counts = {
          none: data.notCharged,
          unpaid: data.unpaid,
          partially_paid: data.partlyPaid,
        };
        return (
          <>
            <FigureList
              figures={OWED_STATUSES.map((status) => ({
                id: status,
                label: tStatus(status),
                value: counts[status],
                href: dashboardLinks.billingByStatus(status),
              }))}
            />
            {Object.values(counts).every((count) => count === 0) ? (
              <EmptyState title={t("empty")} />
            ) : null}
          </>
        );
      }}
    </DashboardPanel>
  );
}
