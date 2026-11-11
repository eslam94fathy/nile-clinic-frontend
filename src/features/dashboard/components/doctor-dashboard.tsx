"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/states/empty-state";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { Instant } from "@/components/shared/values/instant";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import { Can } from "@/features/app-shell/public";
import { LIVE_QUERY } from "@/lib/api/live-query";
import type { LiveList } from "@/lib/api/use-live-list";
import {
  readNextOwnAppointments,
  readOwnQueue,
  readOwnRecords,
} from "../api/dashboard";
import { dashboardLinks } from "../links";
import type { OwnQueue } from "../types";
import { usePanel } from "../use-panel";
import { AppointmentRows } from "./appointment-rows";
import { DashboardGrid } from "./dashboard-grid";
import { DashboardPanel } from "./dashboard-panel";
import { FigureList } from "./figure-list";

/**
 * Who is with the doctor and who is next (User Story 2). It never opens a medical record or a patient's history, and
 * offers nothing that changes the queue: calling and finishing stay on My queue.
 */
export function DoctorDashboard({ timeZone }: { timeZone: string }) {
  return (
    <DashboardGrid>
      <Can capability="ownQueue">
        <OwnQueuePanels timeZone={timeZone} />
      </Can>
      <Can capability="readOwnAppointments">
        <LaterTodayPanel timeZone={timeZone} />
      </Can>
      <Can capability="medicalRecords">
        <RecordsPanel timeZone={timeZone} />
      </Can>
    </DashboardGrid>
  );
}

/** Inside its `Can`, like every other panel's read, so a role without the capability reads nothing. */
function OwnQueuePanels({ timeZone }: { timeZone: string }) {
  // "With you now" and "Waiting" come from one read of the doctor's list, so they can't disagree.
  const queue = usePanel({
    panel: "own-queue",
    read: (_today, locale) => readOwnQueue(locale),
    timeZone,
    policy: LIVE_QUERY,
  });

  return (
    <>
      <WithMeNowPanel list={queue} timeZone={timeZone} />
      <WaitingPanel list={queue} timeZone={timeZone} />
    </>
  );
}

function ProfileNotFound() {
  return (
    <p role="status" className="py-4">
      {useTranslations("dashboard.panel")("profileNotFound")}
    </p>
  );
}

function WithMeNowPanel({
  list,
  timeZone,
}: {
  list: LiveList<OwnQueue>;
  timeZone: string;
}) {
  const t = useTranslations("dashboard.now");

  return (
    <DashboardPanel
      panel="with-me-now"
      heading={t("heading")}
      link={{ href: dashboardLinks.ownQueue, label: t("link") }}
      list={list}
      timeZone={timeZone}
      readsBySelf
      notFound={<ProfileNotFound />}
    >
      {({ current }) =>
        current ? (
          <div className="flex flex-col gap-2">
            <p className="text-xl font-semibold">
              <UserText>{current.patient.full_name}</UserText>
            </p>
            <dl className="flex flex-wrap gap-x-6 gap-y-1">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">{t("number")}</dt>
                <dd>
                  <LtrText>{current.queue_number}</LtrText>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">{t("calledAt")}</dt>
                <dd>
                  <Instant value={current.called_at} timeZone={timeZone} />
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <EmptyState title={t("empty")} />
        )
      }
    </DashboardPanel>
  );
}

/** Everyone waiting, not five: the API returns the doctor's whole list, and it's short (the spec's one exception). */
function WaitingPanel({
  list,
  timeZone,
}: {
  list: LiveList<OwnQueue>;
  timeZone: string;
}) {
  const t = useTranslations("dashboard.waiting");

  return (
    <DashboardPanel
      panel="waiting"
      heading={t("heading")}
      link={{ href: dashboardLinks.ownQueue, label: t("link") }}
      list={list}
      timeZone={timeZone}
      readsBySelf
      notFound={<ProfileNotFound />}
    >
      {({ waiting }) => (
        <>
          <FigureList
            figures={[
              { id: "waiting", label: t("count"), value: waiting.length },
            ]}
          />
          {waiting.length === 0 ? (
            <EmptyState title={t("empty")} />
          ) : (
            <ol aria-label={t("listLabel")} className="flex flex-col divide-y">
              {waiting.map((entry) => (
                <li key={entry.id} className="flex items-baseline gap-3 py-2">
                  <span className="min-w-8 font-medium">
                    <LtrText>{entry.queue_number}</LtrText>
                  </span>
                  <UserText>{entry.patient.full_name}</UserText>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </DashboardPanel>
  );
}

function LaterTodayPanel({ timeZone }: { timeZone: string }) {
  const t = useTranslations("dashboard.later");
  const list = usePanel({
    panel: "later-today",
    read: readNextOwnAppointments,
    timeZone,
    policy: LIVE_QUERY,
  });

  return (
    <DashboardPanel
      panel="later-today"
      heading={t("heading")}
      link={{ href: dashboardLinks.ownAppointmentsToArrive, label: t("link") }}
      list={list}
      timeZone={timeZone}
      readsBySelf
      notFound={<ProfileNotFound />}
    >
      {(appointments) =>
        appointments.total === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <AppointmentRows
            label={t("listLabel")}
            list={appointments}
            href={dashboardLinks.ownAppointment}
          />
        )
      }
    </DashboardPanel>
  );
}

function RecordsPanel({ timeZone }: { timeZone: string }) {
  const t = useTranslations("dashboard.records");
  const tPanel = useTranslations("dashboard.panel");
  const list = usePanel({
    panel: "records",
    read: readOwnRecords,
    timeZone,
    policy: LIVE_QUERY,
  });

  return (
    <DashboardPanel
      panel="records"
      heading={t("heading")}
      link={{
        href: list.data
          ? dashboardLinks.ownVisits(list.data.from, list.data.to, "none")
          : dashboardLinks.ownVisitsDefault,
        label: t("link"),
      }}
      list={list}
      timeZone={timeZone}
      readsBySelf
      notFound={<ProfileNotFound />}
    >
      {({ from, to, none, draft }) => (
        <>
          <FigureList
            figures={[
              {
                id: "none",
                label: t("none"),
                value: none,
                href: dashboardLinks.ownVisits(from, to, "none"),
              },
              {
                id: "draft",
                label: t("draft"),
                value: draft,
                href: dashboardLinks.ownVisits(from, to, "draft"),
              },
            ]}
          />
          <p className="text-[0.8125rem] text-muted-foreground">
            {tPanel.rich("period", {
              from: () => <ClinicDate value={from} />,
              to: () => <ClinicDate value={to} />,
            })}
          </p>
          {none + draft === 0 ? <EmptyState title={t("empty")} /> : null}
        </>
      )}
    </DashboardPanel>
  );
}
